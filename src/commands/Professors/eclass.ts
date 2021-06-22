/* eslint-disable @typescript-eslint/member-ordering */
import { ApplyOptions } from '@sapphire/decorators';
import type { ArgType } from '@sapphire/framework';
import { Args, UserError } from '@sapphire/framework';
import type { SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import dayjs from 'dayjs';
import type { GuildMember, Role } from 'discord.js';
import { MessageEmbed } from 'discord.js';
import pupa from 'pupa';

import { eclass as config } from '@/config/commands/professors';
import messages from '@/config/messages';
import settings from '@/config/settings';
import Eclass from '@/models/eclass';
import ArgumentPrompter from '@/structures/ArgumentPrompter';
import EclassManager from '@/structures/EclassManager';
import MonkaSubCommand from '@/structures/MonkaSubCommand';
import { GuildMessage } from '@/types';
import type { GuildTextBasedChannel, HourMinutes } from '@/types';
import { EclassDocument, EclassStatus } from '@/types/database';
import { generateSubcommands, nullop, ValidateEclassArgument } from '@/utils';

const { prompts } = config.messages;
type PromptKey = keyof typeof prompts;

async function matchNextArg<K extends keyof ArgType>(
  args: Args,
  argType: K,
  argName: PromptKey,
  checkArg = (_arg: ArgType[K]): boolean => true,
): Promise<ArgType[K]> {
  const arg = await args.pickResult<K>(argType);

  if (arg.error || !checkArg(arg.value)) {
    const error = {
      identifier: 'ArgError',
      message: prompts[argName].invalid,
      context: arg.error
        ? arg.error.message
        : 'Error: Argument value is incorrect', // TODO: Custom error?
    };
    throw new UserError(error);
  }

  return arg.value;
}

async function matchArgs<K extends keyof ArgType>(
  args: Args,
  argsList: Array<[k: K, v: PromptKey]>,
): Promise<Partial<Record<PromptKey, ArgType[K]>>> {
  const parsedArgs: Partial<Record<PromptKey, ArgType[K]>> = {};
  for (const [argType, argName] of argsList)
    parsedArgs[argName] = (await matchNextArg(args, argType, argName));

  return parsedArgs;
}

@ApplyOptions<SubCommandPluginCommandOptions>({
  ...config.options,
  generateDashLessAliases: true,
  strategyOptions: {
    flags: ['ping'],
  },
  subCommands: generateSubcommands({
    create: { aliases: ['add'] },
    setup: { aliases: ['build', 'make'] },
    start: { aliases: ['begin'] },
    edit: { aliases: ['modify'] },
    cancel: { aliases: ['archive'] },
    finish: { aliases: ['end', 'stop'] },
    help: { aliases: ['aide'], default: true },
  }),
  preconditions: [
    {
      name: 'customRole',
      context: {
        role: settings.roles.eprof,
        message: config.messages.onlyProfessor,
      },
    },
  ],
})
export default class EclassCommand extends MonkaSubCommand {
  public async create(message: GuildMessage, args: Args): Promise<void> {
    try {
      const parsedArgs = await matchArgs(args, [
        ['guildTextBasedChannel', 'classChannel'],
        ['string', 'topic'],
        ['date', 'date'],
        ['hour', 'hour'],
        ['guildTextBasedChannel', 'classChannel'],
        ['duration', 'duration'],
        ['member', 'professor'],
        ['role', 'targetRole'],
        ['boolean', 'isRecorded'],
      ]); // TODO: Check coherent date

      // parsedArgs.date.setHours(parsedArgs.hour.hour)
      // parsedArgs.date.setMinutes(parsedArgs.hour.minutes);

      await EclassManager.createClass(message, parsedArgs);
  } catch (err: unknown) {
      await (err instanceof UserError
        ? message.channel.send(err.message.toString())
        : message.channel.send(`Unknown Error: ${err}`));
      // Return
    }
  }

  public async setup(message: GuildMessage): Promise<void> {
    let classChannel: GuildTextBasedChannel;
    let topic: string;
    let date: Date;
    let hour: HourMinutes;
    let duration: number;
    let professor: GuildMember;
    let targetRole: Role;
    let isRecorded: boolean;

    // const { prompts } = config.messages;
    try {
      const allMessages: GuildMessage[] = [];
      const prompter = new ArgumentPrompter(message, allMessages);

      classChannel = await prompter.autoPrompt(
        'textChannel',
        prompts.classChannel,
      );
      topic = await prompter.autoPrompt('text',
      prompts.topic);
      date = await prompter.autoPrompt('date', prompts.date);
      hour = await prompter.autoPrompt('hour', prompts.hour);

      date.setHours(hour.hour);
      date.setMinutes(hour.minutes);
      while (!dayjs(date).isBetween(dayjs(), dayjs().add(2, 'month'))) {
        await message.channel.send(config.messages.invalidDate);
        date = await prompter.autoPrompt('date', prompts.date);
        hour = await prompter.autoPrompt('hour', prompts.hour);
        date.setHours(hour.hour);
        date.setMinutes(hour.minutes);
      }
      duration = await prompter.autoPrompt(
        'duration',
        config.messages.prompts.duration,
      );
      professor = await prompter.autoPrompt(
        'member',
        config.messages.prompts.professor,
      );
      targetRole = await prompter.autoPrompt(
        'role',
        config.messages.prompts.targetRole,
      );
      isRecorded = await prompter.autoPrompt(
        'boolean',
        config.messages.prompts.recorded,
      );
    } catch (error: unknown) {
      if ((error as Error).message === 'STOP') {
        await message.channel.send(messages.prompts.stoppedPrompting);
        return;
      }
      throw error;
    }

    await EclassManager.createClass(message, {
      date,
      classChannel,
      topic,
      duration,
      professor,
      targetRole,
      isRecorded,
    });
  }

  public async help(message: GuildMessage, _args: Args): Promise<void> {
    const embed = new MessageEmbed()
      .setTitle(config.messages.helpEmbedTitle)
      .addFields(config.messages.helpEmbedDescription)
      .setColor(settings.colors.default);

    await message.channel.send(embed);
  }

  @ValidateEclassArgument({ statusIn: [EclassStatus.Planned] })
  public async start(
    message: GuildMessage,
    _args: Args,
    eclass: EclassDocument,
  ): Promise<void> {
    // Fetch the member
    const professor = await message.guild.members
      .fetch(eclass.professor)
      .catch(nullop);
    if (!professor) {
      await message.channel.send(config.messages.unresolvedProfessor);
      return;
    }

    // Start the class & confirm.
    await EclassManager.startClass(eclass);
    await message.channel.send(config.messages.successfullyStarted);
  }

  @ValidateEclassArgument({ statusIn: [EclassStatus.Planned] })
  // eslint-disable-next-line complexity
  public async edit(
    message: GuildMessage,
    args: Args,
    eclass: EclassDocument,
  ): Promise<void> {
    // Resolve the given arguments & validate them
    const shouldPing = args.getFlags('ping');
    const property = await args.pickResult('string');
    if (property.error) {
      await message.channel.send(config.messages.invalidEditProperty);
      return;
    }

    let updateMessage: string;
    let notificationMessage: string;

    switch (property.value) {
      case 'topic':
      case 'thème':
      case 'theme':
      case 'sujet': {
        const topic = await args.restResult('string');
        if (topic.error) {
          await message.channel.send(config.messages.prompts.topic.invalid);
          return;
        }

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { topic: topic.value },
          { new: true },
        );
        updateMessage = config.messages.editedTopic;
        notificationMessage = config.messages.pingEditedTopic;
        break;
      }

      case 'date': {
        const newDate = await args.pickResult('day');
        if (newDate.error) {
          await message.channel.send(config.messages.prompts.date.invalid);
          return;
        }

        const date = new Date(eclass.date);
        date.setMonth(newDate.value.getMonth());
        date.setDate(newDate.value.getDate());

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { date: date.getTime(), end: date.getTime() + eclass.duration },
          { new: true },
        );
        updateMessage = config.messages.editedDate;
        notificationMessage = config.messages.pingEditedDate;
        break;
      }

      case 'hour':
      case 'heure': {
        const newHour = await args.pickResult('hour');
        if (newHour.error) {
          await message.channel.send(config.messages.prompts.hour.invalid);
          return;
        }

        const date = new Date(eclass.date);
        date.setHours(newHour.value.hour);
        date.setMinutes(newHour.value.minutes);

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { date: date.getTime(), end: date.getTime() + eclass.duration },
          { new: true },
        );
        updateMessage = config.messages.editedHour;
        notificationMessage = config.messages.pingEditedHour;
        break;
      }

      case 'duration':
      case 'duree':
      case 'durée': {
        const duration = await args.pickResult('duration');
        if (duration.error) {
          await message.channel.send(config.messages.prompts.duration.invalid);
          return;
        }

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { duration: duration.value, end: eclass.date + duration.value },
          { new: true },
        );
        updateMessage = config.messages.editedDuration;
        notificationMessage = config.messages.pingEditedDuration;
        break;
      }

      case 'professor':
      case 'professeur':
      case 'prof': {
        const professor = await args.pickResult('member');
        if (professor.error) {
          await message.channel.send(config.messages.prompts.professor.invalid);
          return;
        }

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { professor: professor.value.id },
          { new: true },
        );
        updateMessage = config.messages.editedProfessor;
        notificationMessage = config.messages.pingEditedProfessor;
        break;
      }

      case 'role':
      case 'rôle': {
        const targetRole = await args.pickResult('role');
        if (targetRole.error) {
          await message.channel.send(
            config.messages.prompts.targetRole.invalid,
          );
          return;
        }

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { targetRole: targetRole.value.id },
          { new: true },
        );
        updateMessage = config.messages.editedRole;
        notificationMessage = config.messages.pingEditedRole;
        break;
      }

      case 'record':
      case 'recorded':
      case 'enregistre':
      case 'enregistré': {
        const isRecorded = await args.pickResult('boolean');
        if (isRecorded.error) {
          await message.channel.send(config.messages.prompts.recorded.invalid);
          return;
        }

        eclass = await Eclass.findByIdAndUpdate(
          eclass._id,
          { isRecorded: isRecorded.value },
          { new: true },
        );
        updateMessage = config.messages.editedRecorded;
        notificationMessage = `${config.messages.pingEditedRecorded}${
          config.messages.pingEditedRecordedValues[Number(isRecorded.value)]
        }`;
        break;
      }

      default:
        await message.channel.send(config.messages.invalidEditProperty);
        return;
    }

    // Fetch the annoucement message
    const originalChannel = await this.context.client.configManager.get(
      message.guild.id,
      eclass.announcementChannel,
    );
    const originalMessage = await originalChannel.messages.fetch(
      eclass.announcementMessage,
    );

    // Edit the announcement embed
    const formattedDate = dayjs(eclass.date).format(
      settings.configuration.dateFormat,
    );
    const classChannel = message.guild.channels.resolve(
      eclass.classChannel,
    ) as GuildTextBasedChannel;
    await originalMessage.edit({
      content: originalMessage.content,
      embed: EclassManager.createAnnoucementEmbed({
        subject: eclass.subject,
        topic: eclass.topic,
        formattedDate,
        duration: eclass.duration,
        professor: await message.guild.members.fetch(eclass.professor),
        classChannel,
        classId: eclass.classId,
        isRecorded: eclass.isRecorded,
      }),
    });

    // Edit the role
    const { subject, topic } = eclass;
    const originalRole = message.guild.roles.resolve(eclass.classRole);
    const newRoleName = pupa(settings.configuration.eclassRoleFormat, {
      subject,
      topic,
      formattedDate,
    });
    if (originalRole.name !== newRoleName)
      await originalRole.setName(newRoleName);

    // Send messages
    const payload = {
      eclass: {
        ...eclass.toData(),
        role: message.guild.roles.resolve(eclass.targetRole).name,
      },
    };
    await message.channel.send(pupa(updateMessage, payload));
    if (shouldPing)
await classChannel.send(pupa(notificationMessage, payload));
  }

  @ValidateEclassArgument({
    statusIn: [EclassStatus.Planned, EclassStatus.InProgress],
  })
  public async cancel(
    message: GuildMessage,
    _args: Args,
    eclass: EclassDocument,
  ): Promise<void> {
    // Cancel the class & confirm.
    await EclassManager.cancelClass(eclass);
    await message.channel.send(config.messages.successfullyCanceled);
  }

  @ValidateEclassArgument({ statusIn: [EclassStatus.InProgress] })
  public async finish(
    message: GuildMessage,
    _args: Args,
    eclass: EclassDocument,
  ): Promise<void> {
    // Fetch the member
    const professor = await message.guild.members
      .fetch(eclass.professor)
      .catch(nullop);
    if (!professor) {
      await message.channel.send(config.messages.unresolvedProfessor);
      return;
    }

    // Finish the class & confirm.
    await EclassManager.finishClass(eclass);
    await message.channel.send(config.messages.successfullyFinished);
  }
}

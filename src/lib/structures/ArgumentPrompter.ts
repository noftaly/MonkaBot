import type { IMessagePrompterExplicitMessageReturn } from '@sapphire/discord.js-utilities';
import { MessagePrompter, MessagePrompterStrategies } from '@sapphire/discord.js-utilities';
import type {
  GuildMember,
  Message,
  Role,
  TextChannel,
} from 'discord.js';
import messages from '@/config/messages';
import settings from '@/config/settings';
import ArgumentResolver from '@/structures/ArgumentResolver';
import type { GuildMessage, GuildTextBasedChannel, HourMinutes } from '@/types';
import { ArgType } from '@sapphire/framework';

// Overwrite 'appliedMessage' and 'response' in 'IMessagePrompterExplicitMessageReturn' for them
// to be GuildMessages rather than Messages
type PrompterMessageResult = Omit<
  IMessagePrompterExplicitMessageReturn,
  'appliedMessage' | 'response'
> & { response: GuildMessage; appliedMessage: GuildMessage };
type PrompterText = Record<'base' | 'invalid', string>;

const resolverDict: { [x: keyof ArgType]: (x) => ArgType[x] } = {
  textChannel: [
    (res: GuildMessage): GuildTextBasedChannel => {
      const chan = res.mentions.channels;
      return chan.size > 0 && chan.first().isText() ? chan.first() : null;
    },

    (res: GuildMessage): GuildTextBasedChannel =>
      ArgumentResolver.resolveChannelByID(res.content.split(' ').join('-'), res.guild),
    (res: GuildMessage): GuildTextBasedChannel =>
      ArgumentResolver.resolveChannelByQuery(res.content.split(' ').join('-'), res.guild),
  ],
  message: [
    async (res: GuildMessage): Promise<Message> =>
      await ArgumentResolver.resolveMessageByID(res.content, res.channel),
    async (res: GuildMessage): Promise<Message> =>
      await ArgumentResolver.resolveMessageByLink(res.content, res.guild, res.author),
  ],
  text: [(res: GuildMessage): string => res.content],
  date: [(res: GuildMessage): Date => ArgumentResolver.resolveDate(res.content)],
  hour: [(res: GuildMessage): HourMinutes => ArgumentResolver.resolveHour(res.content)],
  duration: [(res: GuildMessage): number => ArgumentResolver.resolveDuration(res.content)],
  member: [
    (res: GuildMessage): GuildMember => (res.mentions.members.size > 0 ? res.mentions.members.first() : null),
    (res: GuildMessage): GuildMember => ArgumentResolver.resolveMemberByQuery(res.content, res.guild),
    async (res: GuildMessage): Promise<GuildMember> => ArgumentResolver.resolveMemberByID(res.content, res.guild),
  ],
  role: [
    (res: GuildMessage): Role => (res.mentions.roles.size > 0 ? res.mentions.roles.first() : null),
    (res: GuildMessage): Role => ArgumentResolver.resolveRoleByID(res.content, res.guild),
    (res: GuildMessage): Role => ArgumentResolver.resolveRoleByQuery(res.content, res.guild),
  ],
  boolean: [(res: GuildMessage): boolean => ArgumentResolver.resolveBoolean(res.content)],
};

export default class ArgumentPrompter {
  constructor(
    private readonly _message: GuildMessage,
    private readonly _messageArray?: GuildMessage[],
  ) {}

  public async prompt<K extends keyof typeof resolverDict>(
    promptType: K,
    prompts?: PrompterText,
    previousIsFailure = false,
  ): Promise<K> {
    const response = await this._prompt(
      previousIsFailure
        ? `${prompts?.invalid || messages.prompts.channel.invalid} ${
            prompts?.base || messages.prompts.channel.base
          }`
        : prompts?.base || messages.prompts.channel.base,
    );

    if (response.mentions.channels.size > 0 && response.mentions.channels.first().isText())
      return response.mentions.channels.first();


    const resolvers = resolverDict[promptType];

    let resolvedArg: unknown;
    for (const resolver of resolvers) {
      resolvedArg = resolver(response);
      if (resolvedArg)
        return resolvedArg;
    }

    return null;
  }

  public async autoPrompt(
    promptType: keyof typeof resolverDict,
    prompts?: PrompterText,
  ): Promise<unknown> {
    let response = await this.prompt(promptType, prompts);
    while (!response)
      response = await this.prompt(promptType, prompts, true);
    return response;
  }

  private async _prompt(text: string): Promise<GuildMessage> {
    const handler = new MessagePrompter(
      text,
      MessagePrompterStrategies.Message,
      { timeout: 60 * 1000, explicitReturn: true },
    );
    const { response, appliedMessage } = (await handler.run(
      this._message.channel,
      this._message.author,
    )) as PrompterMessageResult;
    if (this._messageArray)
      this._messageArray.push(response, appliedMessage);

    if (settings.configuration.stop.has(response.content))
      throw new Error('STOP');
    return response;
  }
}

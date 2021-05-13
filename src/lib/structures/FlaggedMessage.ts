import { Store } from '@sapphire/pieces';
import type { GuildMember } from 'discord.js';
import pupa from 'pupa';
import messages from '@/config/messages';
import settings from '@/config/settings';
import FlaggedMessageDB from '@/models/flaggedMessage';
import type { GuildMessage, GuildTextBasedChannel } from '@/types';
import type { FlaggedMessageDocument } from '@/types/database';
import { ConfigEntries } from '@/types/database';
import { nullop } from '@/utils';

type FlaggedMessageData =
  | { manualModerator: GuildMember } & { swear?: never }
  | { manualModerator?: never } & { swear: string };

export default class FlaggedMessage {
  logChannel: GuildTextBasedChannel;
  alertMessage: GuildMessage;
  approvedDate = -1;
  approved = false;
  readonly swear?: string;
  readonly manualModerator?: GuildMember;

  context = Store.injectedContext;

  constructor(
    public readonly message: GuildMessage,
    { swear, manualModerator }: FlaggedMessageData,
  ) {
    this.swear = swear;
    this.manualModerator = manualModerator;
  }

  public static getSwear(message: GuildMessage): string {
    return settings.configuration.swears.find(swr => message.cleanContent.split(' ').includes(swr));
  }

  public static async fromDocument(document: FlaggedMessageDocument): Promise<FlaggedMessage> {
    // Fetch the channel, the "victim", the manual moderator if any, and finally the problematic message
    const channel = Store.injectedContext.client.channels.resolve(document.channelId) as GuildTextBasedChannel;
    await channel.guild.members.fetch(document.authorId);
    if (document.manualModeratorId)
      await channel.guild.members.fetch(document.manualModeratorId);
    const message = await channel.messages.fetch(document.messageId) as GuildMessage;

    // Create the flag message and assign its properties
    const flaggedMessage = new FlaggedMessage(message, { swear: document.swear });
    flaggedMessage.logChannel = await Store.injectedContext.client.configManager.get(
      flaggedMessage.message.guild.id,
      ConfigEntries.ModeratorFeedback,
    );
    flaggedMessage.alertMessage = await flaggedMessage.logChannel.messages
      .fetch(document.alertMessageId) as GuildMessage;
    return flaggedMessage;
  }

  public async start(isManual = false): Promise<void> {
    const document = await FlaggedMessageDB.findOne({ messageId: this.message.id }).catch(nullop);
    if (document)
      return;

    if (isManual) {
      await this._alertModerators();
      await this._addManualToDatabase();
      await this.alertUser();
    } else {
      this.context.client.waitingFlaggedMessages.push(this);
      await this._confirmModerators();
      await this._addToDatabase();
    }
  }

  public async remove(): Promise<void> {
    // Remove the message from the cache & database, and remove the bot's message
    this.context.client.waitingFlaggedMessages = this.context.client.waitingFlaggedMessages
      .filter(msg => msg.message.id !== this.message.id);
    await this.alertMessage.delete();
    await FlaggedMessageDB.findOneAndRemove({ messageId: this.message.id });
  }

  public async approve(moderator: GuildMember): Promise<void> {
    // Remove the message from the cache, and update the bot's message
    this.context.client.waitingFlaggedMessages = this.context.client.waitingFlaggedMessages
      .filter(msg => msg.message.id !== this.message.id);
    await FlaggedMessageDB.updateOne(
      { messageId: this.message.id },
      { approved: true, approvedDate: Date.now() },
    );
    await this.alertMessage.reactions.removeAll();
    await this.alertMessage.edit(
      pupa(messages.antiSwear.swearModAlertUpdate, { message: this.message, swear: this.swear, moderator }),
    );

    await this.alertUser();
  }

  public async alertUser(): Promise<void> {
    const privateMessage = this.swear
      ? messages.antiSwear.swearUserAlert
      : messages.antiSwear.swearManualUserAlert;
    const publicMessage = this.swear
      ? messages.antiSwear.swearUserAlertPublic
      : messages.antiSwear.swearManualUserAlertPublic;
    try {
      await this.message.member.send(pupa(privateMessage, { message: this.message, swear: this.swear }));
    } catch {
      await this.message.channel.send(pupa(publicMessage, { message: this.message, swear: this.swear }));
    }
  }

  private async _addManualToDatabase(): Promise<void> {
    await FlaggedMessageDB.create({
      guildId: this.message.guild.id,
      channelId: this.message.channel.id,
      messageId: this.message.id,
      authorId: this.message.author.id,
      manualModerator: this.manualModerator.id,
      approved: true,
      approvedDate: Date.now(),
    });
  }

  private async _addToDatabase(): Promise<void> {
    await FlaggedMessageDB.create({
      guildId: this.message.guild.id,
      channelId: this.message.channel.id,
      messageId: this.message.id,
      authorId: this.message.author.id,
      swear: this.swear,
      alertMessageId: this.alertMessage.id,
      approved: false,
    });
  }

  private async _alertModerators(): Promise<void> {
    // Cache the log channel if not already
    if (!this.logChannel) {
      this.logChannel = await this.context.client.configManager.get(
        this.message.guild.id,
        ConfigEntries.ModeratorFeedback,
      );
    }

    // Send the alert to the moderators
    if (this.logChannel) {
      const payload = { message: this.message, manualModerator: this.manualModerator };
      await this.logChannel.send(pupa(messages.antiSwear.manualSwearAlert, payload));
    } else {
      this.context.logger.warn(`[Anti Swear] A swear was detected but no log channel was found, unable to report. Setup a log channel with "${settings.prefix}setup mod"`);
    }
  }

  private async _confirmModerators(): Promise<void> {
    // Cache the log channel if not already
    if (!this.logChannel) {
      this.logChannel = await this.context.client.configManager.get(
        this.message.guild.id,
        ConfigEntries.ModeratorFeedback,
      );
    }

    // Send the alert to the moderators
    if (this.logChannel) {
      const payload = { message: this.message, swear: this.swear };
      this.alertMessage = await this.logChannel.send(pupa(messages.antiSwear.swearModAlert, payload)) as GuildMessage;
      await this.alertMessage.react(settings.emojis.yes);
    } else {
      this.context.logger.warn(`[Anti Swear] A swear was detected but no log channel was found, unable to report. Setup a log channel with "${settings.prefix}setup mod"`);
    }
  }
}

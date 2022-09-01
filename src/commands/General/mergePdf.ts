import type { SlashCommandAttachmentOption } from '@discordjs/builders';
import { ApplyOptions } from '@sapphire/decorators';
import { Resolvers } from '@sapphire/framework';
import { filterNullAndUndefined } from '@sapphire/utilities';
import axios from 'axios';
import PDFMerger from 'pdf-merger-js';
import { mergePdf as config } from '@/config/commands/general';
import { HorizonCommand } from '@/structures/commands/HorizonCommand';

enum Options {
  Messages = 'messages',
  Attachment1 = 'attachment1',
  Attachment2 = 'attachment2',
  Attachment3 = 'attachment3',
  Attachment4 = 'attachment4',
  Attachment5 = 'attachment5',
  Attachment6 = 'attachment6',
  Attachment7 = 'attachment7',
  Attachment8 = 'attachment8',
  Attachment9 = 'attachment9',
  Attachment10 = 'attachment10',
  Name = 'name',
}

const attachmentOptions = [
  Options.Attachment1,
  Options.Attachment2,
  Options.Attachment3,
  Options.Attachment4,
  Options.Attachment5,
  Options.Attachment6,
  Options.Attachment7,
  Options.Attachment8,
  Options.Attachment9,
  Options.Attachment10,
] as const;

type AttachmentOptionCallback = (option: SlashCommandAttachmentOption) => SlashCommandAttachmentOption;

function * attachmentGenerator(this: void): Generator<AttachmentOptionCallback, null> {
  for (const attachment of attachmentOptions) {
    yield (option): SlashCommandAttachmentOption => option
      .setName(attachment)
      .setDescription(config.descriptions.options.attachment);
  }
  return null;
}

@ApplyOptions<HorizonCommand.Options>(config)
export default class MergePdfCommand extends HorizonCommand<typeof config> {
  public override registerApplicationCommands(registry: HorizonCommand.Registry): void {
    const multipleAttachmentOptions = attachmentGenerator();

    registry.registerChatInputCommand(
      command => command
        .setName(this.descriptions.name)
        .setDescription(this.descriptions.command)
        .setDMPermission(true)
        .addStringOption(
          option => option
            .setName(Options.Messages)
            .setDescription(this.descriptions.options.messages),
        )
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addAttachmentOption(multipleAttachmentOptions.next().value!)
        .addStringOption(
          option => option
            .setName(Options.Name)
            .setDescription(this.descriptions.options.name),
        ),
    );
  }

  public async chatInputRun(interaction: HorizonCommand.ChatInputInteraction): Promise<void> {
    await interaction.deferReply();

    const name = (interaction.options.getString(Options.Name) ?? 'merged')
      .replace(/\.pdf$/, '')
      .replace(/^\.*/, '');

    const messageUrls = interaction.options.getString(Options.Messages)?.split(' ') ?? [];
    const attachments = attachmentOptions
      .map(option => interaction.options.getAttachment(option))
      .filter(filterNullAndUndefined);

    const messagesResults = await Promise.all(
      messageUrls.map(async url => Resolvers.resolveMessage(url, { messageOrInteraction: interaction })),
    );
    const messages = messagesResults.map(result => result.unwrapOr<null>(null)).filter(filterNullAndUndefined);

    // If no message are given or they don't have any attachments AND no attachments were given in the command's
    // message then we stop here as no PDFs were given at all.
    if (messages.every(msg => msg.attachments.size === 0) && attachments.length === 0) {
      await interaction.followUp({ content: this.messages.noPDFGiven, ephemeral: true });
      return;
    }

    const allFiles = [
      ...attachments,
      ...messages
        .flatMap(msg => [...msg.attachments.values()])
        .filter(file => file.contentType === 'application/pdf'),
    ].filter(filterNullAndUndefined);

    if (allFiles.length < 2) {
      await interaction.followUp({ content: this.messages.notEnoughFiles, ephemeral: true });
      return;
    }

    const merger = new PDFMerger();

    for (const file of allFiles) {
      try {
        const { data: buffer } = await axios.get<Buffer>(file.url, { responseType: 'arraybuffer' });
        await merger.add(buffer);
      } catch (error) {
        this.container.logger.error(error);
        await interaction.followUp({ content: this.messages.error, ephemeral: true });
        return;
      }
    }

    try {
      const pdfBuffer = await merger.saveAsBuffer();
      await interaction.followUp({
        files: [{
          attachment: Buffer.from(pdfBuffer),
          name: `${name}.pdf`,
        }],
      });
    } catch (error) {
      this.container.logger.error(error);
      await interaction.followUp({ content: this.messages.error, ephemeral: true });
    }
  }
}

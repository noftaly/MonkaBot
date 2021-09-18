import { promises as fs } from 'fs';
import path from 'path';
import { ApplyOptions } from '@sapphire/decorators';
import type { Args, CommandOptions } from '@sapphire/framework';
import envPaths from 'env-paths';
import PdfMerger from 'pdf-merger-js';
import { mergePDF as config } from '@/config/commands/general';
import HorizonCommand from '@/structures/commands/HorizonCommand';
import type { GuildMessage } from '@/types';

const merger = new PdfMerger();

const tmpFolder = envPaths('horizonbot').temp;

@ApplyOptions<CommandOptions>(config.options)
export default class PdfMergeCommand extends HorizonCommand {
  public async run(message: GuildMessage, args: Args): Promise<void> {
    // Argument dans l'ordre croissant
    const result = await args.repeatResult('message');

    if (!result.success) {
        await message.channel.send(config.messages.noPdfFound);
        return;
    }

    for (const msg of result.value) {
        // Counting files with the same name
        let counter = 0;
        for (const file of msg.attachments.values()) {
            if (file.name.endsWith('.pdf')) {
                // Renaming the file to avoid duplicates
                file.name = `${file.name}-${message.id}-${counter}.pdf`;
                counter++;
                // Writing the pdf in tmp folder
                await fs.writeFile(tmpFolder, file.url);
                // Add the file into the PdfMerger
                merger.add(path.join(tmpFolder, file.name));
                // Deleting the file
                await fs.unlink(path.join(tmpFolder, file.name));
            }
        }
    }


    const pdfBuffer = await merger.saveAsBuffer();

    await message.channel.send({
        files: [{
            attachment: pdfBuffer,
            name: 'merged.pdf',
        }],
    });
  }
}

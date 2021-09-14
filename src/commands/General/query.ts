import { ApplyOptions } from '@sapphire/decorators';
import type { Args, CommandOptions, UserError } from '@sapphire/framework';
import axios from 'axios';
import pupa from 'pupa';
import { query as config } from '@/config/commands/general';
import MonkaCommand from '@/structures/MonkaCommand';
import type { GuildMessage } from '@/types';

@ApplyOptions<CommandOptions>(config.options)
export default class QueryCommand extends MonkaCommand {
  public async run(message: GuildMessage, args: Args): Promise<void> {
    const parsedArgs: string[] = [];
    while (!args.finished) {
        const arg = await args.pickResult('string');

        if (arg.success)
            parsedArgs.push(arg.value);
         else
            await message.channel.send('Erreur !');
    }

    const { parameter } = (config.messages.invalidQuery as UserError & { parameter: string });

    if (!['get', 'post'].includes(parsedArgs[0])) {
        await message.channel.send(pupa('{error}', { error: parameter }));
        return;
    }

    if (parsedArgs.length < 2) {
        await message.channel.send('Erreur ! Aucune URL spécifiée !');
        return;
    }

    switch (parsedArgs[0]) {
        case 'get': {
            const res = await axios.get(parsedArgs[1]);
            await message.channel.send({
                files: [res.data],
            });

            break;
        }
        case 'post': {
            // Features for POST
            break;
        }
        default: {
            await message.channel.send(pupa('{error}', { error: parameter }));
            break;
        }
    }
  }
}

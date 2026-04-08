import RPC from 'discord-rpc';
import { Client } from 'discord-rpc';
import { config } from './config';

let client: InstanceType<typeof Client> | null = null;
let ready = false;

export async function initDiscord(): Promise<void> {
  client = new RPC.Client({ transport: 'ipc' }) as InstanceType<typeof Client>;

  (client as any).setActivity = (args: any, pid?: number) => {
    let timestamps: any;
    let assets: any;
    let party: any;
    let secrets: any;

    if (args.startTimestamp || args.endTimestamp) {
      timestamps = {
        start: args.startTimestamp instanceof Date ? Math.round(args.startTimestamp.getTime()) : args.startTimestamp,
        end: args.endTimestamp instanceof Date ? Math.round(args.endTimestamp.getTime()) : args.endTimestamp,
      };
    }
    if (args.largeImageKey || args.largeImageText || args.smallImageKey || args.smallImageText) {
      assets = {
        large_image: args.largeImageKey,
        large_text: args.largeImageText,
        small_image: args.smallImageKey,
        small_text: args.smallImageText,
      };
    }
    if (args.partySize || args.partyId || args.partyMax) {
      party = { id: args.partyId };
      if (args.partySize || args.partyMax) party.size = [args.partySize, args.partyMax];
    }
    if (args.matchSecret || args.joinSecret || args.spectateSecret) {
      secrets = { match: args.matchSecret, join: args.joinSecret, spectate: args.spectateSecret };
    }

    const activity: any = {
      state: args.state,
      details: args.details,
      timestamps,
      assets,
      party,
      secrets,
      buttons: args.buttons,
      instance: !!args.instance,
    };

    if (args.type !== undefined) {
      activity.type = args.type;
    }

    if (args.name !== undefined) {
      activity.name = args.name;
    }

    return (client as any).request('SET_ACTIVITY', {
      pid: pid || process.pid,
      activity,
    });
  };

  client.on('ready', () => {
    console.log('Connected to Discord RPC');
    ready = true;
  });

  client.on('disconnected', () => {
    console.log('Discord RPC disconnected, reconnecting in 5s...');
    ready = false;
    setTimeout(reconnect, 5000);
  });

  client.on('error', (err: Error) => {
    console.error('Discord RPC error:', err.message);
    ready = false;
  });

  await client.login({ clientId: config.discordApplicationId });
}

async function reconnect(): Promise<void> {
  try {
    await initDiscord();
  } catch (err: any) {
    console.error('Reconnect failed:', err.message);
    setTimeout(reconnect, 10000);
  }
}

export async function setActivity(activity: Record<string, any>): Promise<void> {
  if (!client) {
    console.error('setActivity SKIPPED: client is null');
    return;
  }
  if (!ready) {
    console.error('setActivity SKIPPED: not ready');
    return;
  }
  try {
    const result = await client.setActivity(activity as any);
    console.log('Activity set:', activity.details, '-', activity.state);
  } catch (err: any) {
    console.error('Failed to set activity:', err.message);
  }
}

export async function clearActivity(): Promise<void> {
  if (!client || !ready) return;
  try {
    await client.clearActivity();
    console.log('Activity cleared');
  } catch (err: any) {
    console.error('Failed to clear activity:', err.message);
  }
}

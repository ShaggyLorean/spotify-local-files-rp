declare module 'discord-rpc' {
  interface RPCClientOptions {
    transport: 'ipc' | 'websocket';
  }

  interface LoginOptions {
    clientId: string;
    clientSecret?: string;
    scopes?: string[];
    redirectUri?: string;
    accessToken?: string;
  }

  interface RichPresence {
    state?: string;
    details?: string;
    startTimestamp?: number;
    endTimestamp?: number;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    instance?: boolean;
    buttons?: Array<{ label: string; url: string }>;
    type?: number;
  }

  type RPCClientEvents = {
    ready(): void;
    disconnected(): void;
    error(err: Error): void;
  };

  class RPCClient {
    constructor(options: RPCClientOptions);
    on<K extends keyof RPCClientEvents>(event: K, listener: RPCClientEvents[K]): this;
    login(options: LoginOptions): Promise<string>;
    setActivity(activity: RichPresence | null, pid?: number): Promise<RichPresence>;
    clearActivity(pid?: number): Promise<void>;
    destroy(): Promise<void>;
    user?: { id: string; username: string; discriminator: string; avatar: string };
  }

  function register(clientId: string): void;

  const _default: {
    Client: typeof RPCClient;
    register: typeof register;
  };

  export default _default;
  export { RPCClient as Client, register };
}

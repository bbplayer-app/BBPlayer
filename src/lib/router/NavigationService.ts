import mitt from 'mitt';

type NavigationEvents = {
  navigate: { path: string; params?: Record<string, any> };
};

const emitter = mitt<NavigationEvents>();

export const NavigationService = {
  navigate: (path: string, params?: Record<string, any>) => {
    emitter.emit('navigate', { path, params });
  },
  events: emitter,
};

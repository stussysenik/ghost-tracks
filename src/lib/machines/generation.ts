import { createMachine, assign } from 'xstate';

export const generationMachine = createMachine({
  id: 'generation',
  initial: 'idle',
  context: {
    neighborhood: '',
    shape: '',
    error: null as string | null,
    result: null as any,
  },
  states: {
    idle: {
      on: {
        START: 'selectingNeighborhood'
      }
    },
    selectingNeighborhood: {
      on: {
        SELECT: {
          target: 'selectingShape',
          actions: assign({
            neighborhood: ({ event }) => event.neighborhood
          })
        }
      }
    },
    selectingShape: {
      on: {
        CHOOSE: {
          target: 'generating',
          actions: assign({
            shape: ({ event }) => event.shape
          })
        },
        BACK: 'selectingNeighborhood'
      }
    },
    generating: {
      invoke: {
        src: 'generateRoute',
        onDone: {
          target: 'success',
          actions: assign({
            result: ({ event }) => event.output
          })
        },
        onError: {
          target: 'failure',
          actions: assign({
            error: ({ event }) => event.error.message
          })
        }
      }
    },
    success: {
      on: {
        RETRY: 'idle'
      }
    },
    failure: {
      on: {
        RETRY: 'selectingShape'
      }
    }
  }
});

/**
 * Radix Toast wired into a tiny context — `useToast()()` from anywhere.
 * Enter/exit use our own cubic-bezier curves, never library defaults.
 */
import * as Toast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';

type ToastFn = (title: string, description?: string) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

const slideIn = keyframes`
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; transform: translateY(8px); }
`;

const Root = styled(Toast.Root)`
  background: ${({ theme }) => theme.color.coal};
  color: ${({ theme }) => theme.color.paper};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.float};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  display: flex;
  flex-direction: column;
  gap: 2px;

  &[data-state='open'] {
    animation: ${slideIn} 280ms ${({ theme }) => theme.ease.out};
  }
  &[data-state='closed'] {
    animation: ${fadeOut} 180ms ${({ theme }) => theme.ease.inOut};
  }
`;

const Title = styled(Toast.Title)`
  font-size: ${({ theme }) => theme.type.small};
  font-weight: 600;
`;

const Description = styled(Toast.Description)`
  font-size: ${({ theme }) => theme.type.small};
  color: ${({ theme }) => theme.color.mist};
`;

const Viewport = styled(Toast.Viewport)`
  position: fixed;
  bottom: ${({ theme }) => theme.space.lg};
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
  width: auto;
  max-width: 380px;
  margin: 0;
  padding: 0;
  list-style: none;
  z-index: ${({ theme }) => theme.z.toast};
  outline: none;
`;

interface Item {
  id: number;
  title: string;
  description?: string;
}

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const toast = useCallback<ToastFn>((title, description) => {
    setItems((prev) => [...prev, { id: Date.now() + Math.random(), title, description }]);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      <Toast.Provider swipeDirection="down" duration={3200}>
        {children}
        {items.map((item) => (
          <Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((i) => i.id !== item.id));
            }}
          >
            <Title>{item.title}</Title>
            {item.description ? <Description>{item.description}</Description> : null}
          </Root>
        ))}
        <Viewport />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Per-platform import instructions — Radix Accordion (keyboard accessible),
 * shared between the Studio export dialog and the Share page.
 */
import * as Accordion from '@radix-ui/react-accordion';
import styled, { keyframes } from 'styled-components';
import { PLATFORM_GUIDES } from '../lib/platforms';

const open = keyframes`
  from { height: 0; opacity: 0; }
  to   { height: var(--radix-accordion-content-height); opacity: 1; }
`;

const close = keyframes`
  from { height: var(--radix-accordion-content-height); opacity: 1; }
  to   { height: 0; opacity: 0; }
`;

const Root = styled(Accordion.Root)`
  border: 1px solid ${({ theme }) => theme.color.line};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  background: ${({ theme }) => theme.color.surface};
`;

const Item = styled(Accordion.Item)`
  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.color.line};
  }
`;

const Trigger = styled(Accordion.Trigger)`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: ${({ theme }) => theme.type.small};
  font-weight: 600;
  cursor: pointer;
  transition: background-color 160ms ${({ theme }) => theme.ease.out};

  &:hover {
    background: ${({ theme }) => theme.color.paper};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
    outline-offset: -2px;
  }

  svg {
    transition: transform 220ms ${({ theme }) => theme.ease.out};
  }
  &[data-state='open'] svg {
    transform: rotate(180deg);
  }
`;

const Content = styled(Accordion.Content)`
  overflow: hidden;
  &[data-state='open'] {
    animation: ${open} 260ms ${({ theme }) => theme.ease.out};
  }
  &[data-state='closed'] {
    animation: ${close} 200ms ${({ theme }) => theme.ease.inOut};
  }
`;

const Steps = styled.ol`
  margin: 0;
  padding: 0 1rem 1rem 2.25rem;
  font-size: ${({ theme }) => theme.type.small};
  color: ${({ theme }) => theme.color.slate};
  line-height: 1.65;
  list-style: decimal;

  li + li {
    margin-top: 0.25rem;
  }
`;

const Note = styled.p`
  margin: 0;
  padding: 0 1rem 0.625rem 1rem;
  font-size: ${({ theme }) => theme.type.micro};
  color: ${({ theme }) => theme.color.warn};
`;

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ImportInstructions() {
  return (
    <Root type="single" collapsible defaultValue="strava">
      {PLATFORM_GUIDES.map((p) => (
        <Item key={p.id} value={p.id}>
          <Accordion.Header asChild>
            <h3 style={{ margin: 0 }}>
              <Trigger>
                {p.name}
                <Chevron />
              </Trigger>
            </h3>
          </Accordion.Header>
          <Content>
            {p.note ? <Note>{p.note}</Note> : null}
            <Steps>
              {p.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </Steps>
          </Content>
        </Item>
      ))}
    </Root>
  );
}

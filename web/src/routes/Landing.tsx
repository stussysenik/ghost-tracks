/**
 * Landing / Compose — the "ChatGPT for runners" moment.
 * Hero prompt → /studio. Occasion chips prefill prompts; example gallery
 * and recent local creations give one-tap starts.
 */
import { motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { loadRecent } from '../lib/storage';
import { theme as tokens } from '../theme';
import { Button, Card, Chip, Kicker } from '../components/ui';

const OCCASIONS = [
  {
    emoji: '❤️',
    label: "Valentine's",
    prompt:
      "for valentine's day — write 'ANNA + TOM' and a heart, near Vinohrady, about 8 km, end where we start"
  },
  {
    emoji: '💍',
    label: 'Proposal',
    prompt: "write 'MARRY ME?' with a ring shape, near Letná park, about 10 km, loop back to the start"
  },
  {
    emoji: '🎂',
    label: 'Birthday',
    prompt: "draw a birthday cake with 'HBD MOM' next to it, near Karlín, about 6 km"
  }
];

const EXAMPLES = [
  {
    title: 'ANNA + TOM ❤',
    meta: '8.2 km · Vinohrady · fidelity 84',
    prompt: OCCASIONS[0].prompt,
    path: 'M20 26 C20 18 30 16 35 22 C40 16 50 18 50 26 C50 34 35 44 35 44 C35 44 20 34 20 26 Z'
  },
  {
    title: 'Run a fox',
    meta: '11.5 km · Stromovka · fidelity 71',
    prompt: 'draw a fox, near Stromovka, about 12 km, loop',
    path: 'M14 40 L24 22 L30 30 L40 30 L46 22 L56 40 L46 46 L35 42 L24 46 Z'
  },
  {
    title: 'PRAHA lettering',
    meta: '14 km · Old Town · fidelity 76',
    prompt: "write 'PRAHA' in big letters across the old town, about 14 km",
    path: 'M12 44 L12 22 L22 22 L22 32 L12 32 M28 44 L34 22 L40 44 M31 36 L37 36 M46 44 L46 22 L56 22 L56 32 L46 32 L56 44'
  }
];

const Page = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

const Hero = styled.main`
  flex: 1;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space.xxl} ${theme.space.lg}`};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const Title = styled.h1`
  margin: ${({ theme }) => `${theme.space.md} 0 ${theme.space.sm}`};
  font-size: clamp(2.25rem, 5.5vw, ${({ theme }) => theme.type.hero});
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.08;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.color.ink};
  }
`;

const Sub = styled.p`
  margin: 0 0 ${({ theme }) => theme.space.xl};
  max-width: 34em;
  color: ${({ theme }) => theme.color.slate};
  line-height: 1.6;
`;

const PromptForm = styled.form`
  width: 100%;
  max-width: 640px;
  display: flex;
  gap: ${({ theme }) => theme.space.sm};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.line};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.card};
  padding: ${({ theme }) => theme.space.sm};
  transition:
    border-color 200ms ${({ theme }) => theme.ease.out},
    box-shadow 200ms ${({ theme }) => theme.ease.out};

  &:focus-within {
    border-color: ${({ theme }) => theme.color.ink};
    box-shadow: 0 0 0 4px ${({ theme }) => theme.color.inkWash}, ${({ theme }) => theme.shadow.card};
  }
`;

const PromptInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 0.5rem 0.75rem;
  font-size: ${({ theme }) => theme.type.body};
  color: ${({ theme }) => theme.color.coal};

  &::placeholder {
    color: ${({ theme }) => theme.color.mist};
  }
`;

const GalleryCard = styled(Card)`
  padding: ${({ theme }) => theme.space.md};
  text-align: left;
  cursor: pointer;
  transition:
    transform 220ms ${({ theme }) => theme.ease.out},
    box-shadow 220ms ${({ theme }) => theme.ease.out},
    border-color 220ms ${({ theme }) => theme.ease.out};

  &:hover {
    transform: translateY(-3px);
    box-shadow: ${({ theme }) => theme.shadow.float};
    border-color: ${({ theme }) => theme.color.inkSoft};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
    outline-offset: 2px;
  }
`;

const RecentItem = styled.button`
  all: unset;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.type.small};
  cursor: pointer;
  transition: background-color 160ms ${({ theme }) => theme.ease.out};

  &:hover {
    background: ${({ theme }) => theme.color.surface};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.ink};
  }

  span {
    color: ${({ theme }) => theme.color.mist};
    white-space: nowrap;
  }
`;

const rise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 }
};

export function Landing() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const recent = useMemo(loadRecent, []);

  const go = (p: string) => {
    const trimmed = p.trim();
    if (!trimmed) return;
    navigate(`/studio?prompt=${encodeURIComponent(trimmed)}`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(prompt);
  };

  return (
    <Page>
      <Hero>
        <motion.div {...rise} transition={{ ...tokens.ease.spring }}>
          <Kicker>Ghost Tracks · Prague</Kicker>
          <Title>
            Describe it. <em>Run it.</em>
          </Title>
          <Sub>
            Tell us the occasion — we compose names, hearts, anything into one continuous line and
            solve a real, runnable route through city streets. GPX in under two minutes.
          </Sub>
        </motion.div>

        <motion.div
          {...rise}
          transition={{ ...tokens.ease.spring, delay: 0.06 }}
          className="w-full stack-center gap-4"
        >
          <PromptForm onSubmit={onSubmit} role="search">
            <PromptInput
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="for valentine's day — write 'ANNA + TOM' and a heart, near Vinohrady…"
              aria-label="Describe your route art"
            />
            <Button type="submit" disabled={!prompt.trim()}>
              Compose →
            </Button>
          </PromptForm>

          <div className="row gap-2 flex-wrap justify-center" aria-label="Occasions">
            {OCCASIONS.map((o) => (
              <Chip key={o.label} type="button" onClick={() => setPrompt(o.prompt)}>
                <span aria-hidden>{o.emoji}</span> {o.label}
              </Chip>
            ))}
          </div>
        </motion.div>

        <motion.section
          {...rise}
          transition={{ ...tokens.ease.spring, delay: 0.12 }}
          className="w-full mt-16 text-left"
          aria-label="Examples"
        >
          <Kicker>What people run</Kicker>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            {EXAMPLES.map((ex) => (
              <GalleryCard
                key={ex.title}
                as="button"
                type="button"
                onClick={() => go(ex.prompt)}
                aria-label={`Use example: ${ex.title}`}
              >
                <svg viewBox="0 0 70 60" className="w-full h-24 mb-3" aria-hidden>
                  <path
                    d={ex.path}
                    fill="none"
                    stroke={tokens.color.ink}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="f-small font-600">{ex.title}</div>
                <div className="f-small" style={{ color: tokens.color.mist }}>
                  {ex.meta}
                </div>
              </GalleryCard>
            ))}
          </div>
        </motion.section>

        {recent.length > 0 && (
          <motion.section
            {...rise}
            transition={{ ...tokens.ease.spring, delay: 0.18 }}
            className="w-full mt-12 text-left"
            aria-label="Recent creations"
          >
            <Kicker>Recent</Kicker>
            <div className="stack gap-1 mt-3">
              {recent.map((r) => (
                <RecentItem key={r.at} onClick={() => go(r.prompt)}>
                  <span className="truncate" style={{ color: tokens.color.coal }}>
                    {r.prompt}
                  </span>
                  <span>
                    {r.distance_km ? `${r.distance_km.toFixed(1)} km · ` : ''}
                    {new Date(r.at).toLocaleDateString()}
                  </span>
                </RecentItem>
              ))}
            </div>
          </motion.section>
        )}
      </Hero>

      <footer className="row-center pb-6 f-small" style={{ color: tokens.color.mist }}>
        Routes solve on real Prague streets · export GPX for Strava, Garmin, Komoot
      </footer>
    </Page>
  );
}

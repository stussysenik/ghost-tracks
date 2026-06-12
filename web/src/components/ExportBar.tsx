/**
 * Export bar — GPX download (with a Radix Dialog of import instructions)
 * and Share (POST /api/art/share → copy /r/:id link, toast confirmation).
 */
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { shareArt, ApiError } from '../api';
import { downloadGPX, gpxFilename } from '../lib/gpx';
import type { ArtRoute } from '../types';
import { ImportInstructions } from './ImportInstructions';
import { useToast } from './Toaster';
import { Button } from './ui';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const Overlay = styled(Dialog.Overlay)`
  position: fixed;
  inset: 0;
  background: rgba(24, 24, 27, 0.4);
  z-index: ${({ theme }) => theme.z.toast - 1};
  animation: ${fadeIn} 200ms ${({ theme }) => theme.ease.out};
`;

const Panel = styled(Dialog.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(480px, calc(100vw - 2rem));
  max-height: 80vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.color.paper};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.float};
  padding: ${({ theme }) => theme.space.lg};
  z-index: ${({ theme }) => theme.z.toast};
  animation: ${popIn} 260ms ${({ theme }) => theme.ease.out};

  &:focus {
    outline: none;
  }
`;

const DialogTitle = styled(Dialog.Title)`
  margin: 0 0 0.25rem;
  font-size: ${({ theme }) => theme.type.title};
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const DialogDesc = styled(Dialog.Description)`
  margin: 0 0 1rem;
  font-size: ${({ theme }) => theme.type.small};
  color: ${({ theme }) => theme.color.slate};
`;

function routeName(route: ArtRoute): string {
  const parts = [...route.intent.texts, ...route.intent.shapes.map((s) => s.name)];
  return parts.join(' ') || route.intent.occasion || 'route';
}

export function ExportBar({ route, disabled }: { route: ArtRoute | null; disabled?: boolean }) {
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const onDownload = () => {
    if (!route) return;
    downloadGPX(route.solve.coordinates, routeName(route));
    setDialogOpen(true);
    toast('GPX downloaded', gpxFilename(routeName(route)));
  };

  const onShare = async () => {
    if (!route || sharing) return;
    setSharing(true);
    try {
      const shareId = route.share_id ?? (await shareArt(route)).share_id;
      const url = `${window.location.origin}/r/${shareId}`;
      await navigator.clipboard.writeText(url);
      toast('Share link copied', url);
    } catch (err) {
      toast(
        'Could not create share link',
        err instanceof ApiError ? err.message : 'Try again in a moment.'
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="row gap-2" data-testid="export-bar">
      <Button onClick={onDownload} disabled={disabled || !route}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M7 1v8m0 0L4 6m3 3l3-3M2 12h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download GPX
      </Button>
      <Button $variant="ghost" onClick={onShare} disabled={disabled || !route || sharing}>
        {sharing ? 'Sharing…' : 'Share link'}
      </Button>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Overlay />
          <Panel>
            <DialogTitle>Your route is ready to run</DialogTitle>
            <DialogDesc>
              Import the GPX into your platform of choice — then record the run and watch the art
              appear.
            </DialogDesc>
            <ImportInstructions />
            <div className="row justify-end mt-4">
              <Dialog.Close asChild>
                <Button $variant="ghost">Done</Button>
              </Dialog.Close>
            </div>
          </Panel>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

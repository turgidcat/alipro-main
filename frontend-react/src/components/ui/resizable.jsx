import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '../../lib/utils.js';

const ResizablePanelGroup = React.forwardRef(function ResizablePanelGroup(
  { className, ...props },
  ref
) {
  return (
    <PanelGroup
      ref={ref}
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  );
});

const ResizablePanel = Panel;

const ResizableHandle = React.forwardRef(function ResizableHandle(
  { className, withHandle, ...props },
  ref
) {
  return (
    <PanelResizeHandle
      ref={ref}
      className={cn(
        'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2',
        'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:h-3 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-soft-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-8 w-4 items-center justify-center rounded-full border border-border bg-surface">
          <span className="block h-4 w-[2px] rounded-full bg-[color:var(--muted-foreground)]" />
        </div>
      ) : null}
    </PanelResizeHandle>
  );
});

ResizablePanelGroup.displayName = 'ResizablePanelGroup';
ResizableHandle.displayName = 'ResizableHandle';

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

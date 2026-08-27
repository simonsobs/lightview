import { ReactNode, useState } from 'react';

interface TooltipButtonProps {
  tooltipText: string;
  tooltipClassName: string;
  buttonClassName: string;
  onClick: () => void;
  /** NOTE: uses aria-disabled in order to propagate hover events */
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * A button that shows a small tooltip on hover. Renders no wrapping element of its own -
 * callers are expected to render it inside an already-positioned container (see
 * .flux-filter-btn-container / .active-filter-subtitle-container in flux-filter.css) so the
 * tooltip's `position: absolute` has the right element to anchor to.
 */
export default function TooltipButton({
  tooltipText,
  tooltipClassName,
  buttonClassName,
  onClick,
  disabled,
  title,
  ariaLabel,
  children,
}: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </button>
      {showTooltip && <div className={tooltipClassName}>{tooltipText}</div>}
    </>
  );
}

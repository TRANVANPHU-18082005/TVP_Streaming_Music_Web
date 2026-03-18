import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (value: number) => void;
  className?: string;
  isLoading?: boolean;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onItemsPerPageChange,
  className,
  isLoading = false,
}: PaginationProps) => {
  const [jumpValue, setJumpValue] = useState("");
  const [jumpFocused, setJumpFocused] = useState(false);
  const [ripplePage, setRipplePage] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setJumpValue("");
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || isLoading)
      return;
    setRipplePage(page);
    setTimeout(() => setRipplePage(null), 400);
    onPageChange(page);
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page);
      inputRef.current?.blur();
    } else {
      setJumpValue("");
      inputRef.current?.select();
    }
  };

  const { startItem, endItem } = useMemo(() => {
    if (totalItems === 0) return { startItem: 0, endItem: 0 };
    return {
      startItem: (currentPage - 1) * itemsPerPage + 1,
      endItem: Math.min(currentPage * itemsPerPage, totalItems),
    };
  }, [currentPage, itemsPerPage, totalItems]);

  // Smart windowing: always show first, last, and window around current
  const pageNumbers = useMemo((): (
    | number
    | "ellipsis-start"
    | "ellipsis-end"
  )[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];
    const showLeft = currentPage > 3;
    const showRight = currentPage < totalPages - 2;

    pages.push(1);

    if (showLeft) pages.push("ellipsis-start");
    else pages.push(2);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) pages.push(i);
    }

    if (showRight) pages.push("ellipsis-end");
    else {
      if (!pages.includes(totalPages - 1)) pages.push(totalPages - 1);
    }

    if (!pages.includes(totalPages)) pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  const progressPercent =
    totalPages > 0 ? ((currentPage - 1) / (totalPages - 1)) * 100 : 0;

  return (
    <div className={cn("pagination-root", className)}>
      {/* Progress bar */}
      <div className="progress-track" aria-hidden="true">
        <div
          className="progress-fill"
          style={{ width: totalPages <= 1 ? "100%" : `${progressPercent}%` }}
        />
      </div>

      <div className="pagination-inner">
        {/* LEFT: Stats + rows per page */}
        <div className="pagination-left">
          <span className="stats-label">
            <span className="stats-range">
              {startItem}–{endItem}
            </span>
            <span className="stats-sep">/</span>
            <span className="stats-total">{totalItems.toLocaleString()}</span>
            <span className="stats-word">tracks</span>
          </span>

          {onItemsPerPageChange && (
            <div className="rows-control">
              <span className="rows-label">per page</span>
              <div className="select-wrapper">
                <select
                  value={itemsPerPage}
                  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                  className="rows-select"
                  aria-label="Items per page"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
                <span className="select-chevron" aria-hidden="true">
                  ▾
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CENTER: Navigation */}
        <nav className="pagination-nav" aria-label="Pagination">
          {/* First page */}
          <button
            className="nav-btn nav-btn-edge"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isLoading}
            aria-label="First page"
            title="First page"
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Prev */}
          <button
            className="nav-btn nav-btn-arrow"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page numbers - desktop */}
          <div className="page-numbers" role="list">
            {pageNumbers.map((page, idx) =>
              page === "ellipsis-start" || page === "ellipsis-end" ? (
                <span key={page} className="ellipsis" aria-hidden="true">
                  ···
                </span>
              ) : (
                <button
                  key={`page-${page}`}
                  role="listitem"
                  className={cn(
                    "page-btn",
                    currentPage === page && "page-btn--active",
                    ripplePage === page && "page-btn--ripple",
                  )}
                  onClick={() => handlePageChange(page as number)}
                  disabled={isLoading}
                  aria-label={`Page ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </button>
              ),
            )}
          </div>

          {/* Mobile indicator */}
          <div className="mobile-indicator" aria-live="polite">
            <span className="mobile-current">{currentPage}</span>
            <span className="mobile-sep">/</span>
            <span className="mobile-total">{totalPages}</span>
          </div>

          {/* Next */}
          <button
            className="nav-btn nav-btn-arrow"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={
              currentPage === totalPages || totalPages === 0 || isLoading
            }
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>

          {/* Last page */}
          <button
            className="nav-btn nav-btn-edge"
            onClick={() => handlePageChange(totalPages)}
            disabled={
              currentPage === totalPages || totalPages === 0 || isLoading
            }
            aria-label="Last page"
            title="Last page"
          >
            <ChevronsRight size={15} />
          </button>
        </nav>

        {/* RIGHT: Jump to page */}
        <form onSubmit={handleJump} className="jump-form" noValidate>
          <label className="jump-label" htmlFor="page-jump">
            Go to
          </label>
          <div
            className={cn(
              "jump-input-wrap",
              jumpFocused && "jump-input-wrap--focused",
            )}
          >
            <input
              ref={inputRef}
              id="page-jump"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={String(currentPage)}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value.replace(/\D/g, ""))}
              onFocus={() => setJumpFocused(true)}
              onBlur={() => setJumpFocused(false)}
              className="jump-input"
              aria-label="Jump to page number"
              maxLength={String(totalPages).length}
            />
          </div>
          <button
            type="submit"
            className="jump-btn"
            aria-label="Go to page"
            disabled={isLoading}
          >
            <CornerDownRight size={13} />
          </button>
        </form>
      </div>

      <style>{`
        /* ============================================
           PAGINATION – MUSIC STREAMING EDITION
           Supports .dark class on any ancestor
        ============================================ */

        /* ---------- CSS Variables ---------- */
        .pagination-root {
          /* Light mode tokens */
          --pg-bg: #faf9f7;
          --pg-surface: #ffffff;
          --pg-surface-hover: #f3f1ee;
          --pg-border: rgba(0,0,0,0.08);
          --pg-text: #1a1814;
          --pg-muted: #8a8580;
          --pg-accent: #e8622a;
          --pg-accent-fg: #ffffff;
          --pg-accent-glow: rgba(232,98,42,0.18);
          --pg-track: rgba(0,0,0,0.07);
          --pg-progress: linear-gradient(90deg, #e8622a 0%, #f0954a 100%);
          --pg-shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
          --pg-shadow-md: 0 4px 12px rgba(0,0,0,0.10);
          --pg-font-mono: "SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
          --pg-font-ui: "DM Sans", "Outfit", system-ui, sans-serif;
          --pg-radius: 10px;
          --pg-radius-sm: 7px;
          --pg-transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Dark mode – activated by .dark on any ancestor */
        :is(.dark) .pagination-root {
          --pg-bg: #0d0f14;
          --pg-surface: #161921;
          --pg-surface-hover: #1e2230;
          --pg-border: rgba(255,255,255,0.07);
          --pg-text: #e8e6e1;
          --pg-muted: #636878;
          --pg-accent: #7c6af7;
          --pg-accent-fg: #ffffff;
          --pg-accent-glow: rgba(124,106,247,0.22);
          --pg-track: rgba(255,255,255,0.06);
          --pg-progress: linear-gradient(90deg, #7c6af7 0%, #a78bfa 100%);
          --pg-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
          --pg-shadow-md: 0 4px 16px rgba(0,0,0,0.4);
        }

        /* ---------- Root ---------- */
        .pagination-root {
          font-family: var(--pg-font-ui);
          background: var(--pg-bg);
          border-top: 1px solid var(--pg-border);
          padding: 0;
          user-select: none;
          -webkit-user-select: none;
        }

        /* ---------- Progress Bar ---------- */
        .progress-track {
          height: 2px;
          background: var(--pg-track);
          position: relative;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--pg-progress);
          border-radius: 0 2px 2px 0;
          transition: width 380ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ---------- Inner Layout ---------- */
        .pagination-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 16px;
          flex-wrap: wrap;
        }

        /* ---------- LEFT: Stats ---------- */
        .pagination-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .stats-label {
          display: flex;
          align-items: baseline;
          gap: 4px;
          font-size: 12px;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .stats-range {
          font-family: var(--pg-font-mono);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--pg-text);
        }
        .stats-sep {
          color: var(--pg-muted);
          font-weight: 300;
          font-size: 11px;
        }
        .stats-total {
          font-family: var(--pg-font-mono);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--pg-text);
        }
        .stats-word {
          color: var(--pg-muted);
          font-size: 11px;
          font-weight: 400;
          margin-left: 1px;
        }

        /* Rows per page */
        .rows-control {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-left: 14px;
          border-left: 1px solid var(--pg-border);
        }
        .rows-label {
          font-size: 11px;
          color: var(--pg-muted);
          white-space: nowrap;
          font-weight: 400;
        }
        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .rows-select {
          appearance: none;
          -webkit-appearance: none;
          background: var(--pg-surface);
          border: 1px solid var(--pg-border);
          border-radius: var(--pg-radius-sm);
          color: var(--pg-text);
          font-family: var(--pg-font-mono);
          font-size: 11.5px;
          font-weight: 600;
          padding: 3px 22px 3px 8px;
          cursor: pointer;
          outline: none;
          box-shadow: var(--pg-shadow-sm);
          transition: border-color var(--pg-transition), box-shadow var(--pg-transition);
          line-height: 1.5;
        }
        .rows-select:hover,
        .rows-select:focus {
          border-color: var(--pg-accent);
          box-shadow: 0 0 0 3px var(--pg-accent-glow);
        }
        .rows-select option {
          background: var(--pg-surface);
          color: var(--pg-text);
        }
        .select-chevron {
          position: absolute;
          right: 6px;
          pointer-events: none;
          font-size: 9px;
          color: var(--pg-muted);
          line-height: 1;
        }

        /* ---------- CENTER: Navigation ---------- */
        .pagination-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        /* Nav buttons */
        .nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--pg-surface);
          border: 1px solid var(--pg-border);
          border-radius: var(--pg-radius-sm);
          color: var(--pg-muted);
          cursor: pointer;
          outline: none;
          box-shadow: var(--pg-shadow-sm);
          transition:
            color var(--pg-transition),
            background var(--pg-transition),
            border-color var(--pg-transition),
            box-shadow var(--pg-transition),
            transform 100ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-btn:hover:not(:disabled) {
          background: var(--pg-surface-hover);
          border-color: var(--pg-accent);
          color: var(--pg-accent);
          box-shadow: 0 0 0 3px var(--pg-accent-glow), var(--pg-shadow-sm);
        }
        .nav-btn:active:not(:disabled) {
          transform: scale(0.93);
        }
        .nav-btn:disabled {
          opacity: 0.32;
          cursor: not-allowed;
          box-shadow: none;
        }
        .nav-btn-arrow {
          width: 34px;
          height: 34px;
        }
        .nav-btn-edge {
          width: 30px;
          height: 34px;
        }

        /* Page numbers */
        .page-numbers {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        @media (max-width: 600px) {
          .page-numbers { display: none; }
        }

        .page-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--pg-font-mono);
          font-size: 12px;
          font-weight: 500;
          background: var(--pg-surface);
          border: 1px solid var(--pg-border);
          border-radius: var(--pg-radius-sm);
          color: var(--pg-muted);
          cursor: pointer;
          outline: none;
          box-shadow: var(--pg-shadow-sm);
          transition:
            color var(--pg-transition),
            background var(--pg-transition),
            border-color var(--pg-transition),
            box-shadow var(--pg-transition),
            transform 100ms ease;
          position: relative;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .page-btn:hover:not(:disabled):not(.page-btn--active) {
          background: var(--pg-surface-hover);
          border-color: var(--pg-accent);
          color: var(--pg-accent);
          box-shadow: 0 0 0 3px var(--pg-accent-glow), var(--pg-shadow-sm);
        }
        .page-btn:active:not(:disabled) {
          transform: scale(0.90);
        }
        .page-btn--active {
          background: var(--pg-accent);
          border-color: var(--pg-accent);
          color: var(--pg-accent-fg);
          font-weight: 700;
          box-shadow: 0 0 0 3px var(--pg-accent-glow), var(--pg-shadow-md);
          cursor: default;
          pointer-events: none;
        }

        /* Ripple effect on page change */
        .page-btn--ripple::after {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--pg-accent);
          opacity: 0;
          border-radius: inherit;
          animation: pg-ripple 0.4s ease-out;
        }
        @keyframes pg-ripple {
          0% { opacity: 0.35; transform: scale(0.4); }
          100% { opacity: 0; transform: scale(2.5); }
        }

        .ellipsis {
          width: 28px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: var(--pg-muted);
          letter-spacing: 1px;
          pointer-events: none;
        }

        /* Mobile indicator */
        .mobile-indicator {
          display: none;
          align-items: baseline;
          gap: 3px;
          padding: 0 4px;
        }
        @media (max-width: 600px) {
          .mobile-indicator { display: flex; }
        }
        .mobile-current {
          font-family: var(--pg-font-mono);
          font-size: 14px;
          font-weight: 700;
          color: var(--pg-accent);
        }
        .mobile-sep {
          font-size: 11px;
          color: var(--pg-muted);
        }
        .mobile-total {
          font-family: var(--pg-font-mono);
          font-size: 12px;
          font-weight: 500;
          color: var(--pg-muted);
        }

        /* ---------- RIGHT: Jump ---------- */
        .jump-form {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .jump-label {
          font-size: 11px;
          color: var(--pg-muted);
          white-space: nowrap;
          cursor: default;
        }
        @media (max-width: 460px) {
          .jump-label { display: none; }
        }
        .jump-input-wrap {
          position: relative;
          transition: box-shadow var(--pg-transition);
          border-radius: var(--pg-radius-sm);
        }
        .jump-input-wrap--focused {
          box-shadow: 0 0 0 3px var(--pg-accent-glow);
        }
        .jump-input {
          width: 52px;
          height: 34px;
          background: var(--pg-surface);
          border: 1px solid var(--pg-border);
          border-radius: var(--pg-radius-sm);
          color: var(--pg-text);
          font-family: var(--pg-font-mono);
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          padding: 0 6px;
          outline: none;
          transition: border-color var(--pg-transition);
          box-shadow: var(--pg-shadow-sm);
        }
        .jump-input::placeholder {
          color: var(--pg-muted);
          font-weight: 400;
          opacity: 0.7;
        }
        .jump-input-wrap--focused .jump-input {
          border-color: var(--pg-accent);
        }

        .jump-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--pg-accent);
          border: none;
          border-radius: var(--pg-radius-sm);
          color: var(--pg-accent-fg);
          cursor: pointer;
          outline: none;
          box-shadow: 0 0 0 0 var(--pg-accent-glow), var(--pg-shadow-sm);
          transition:
            background var(--pg-transition),
            box-shadow var(--pg-transition),
            transform 100ms ease,
            opacity var(--pg-transition);
        }
        .jump-btn:hover:not(:disabled) {
          box-shadow: 0 0 0 4px var(--pg-accent-glow), var(--pg-shadow-md);
          filter: brightness(1.08);
        }
        .jump-btn:active:not(:disabled) {
          transform: scale(0.91);
        }
        .jump-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ---------- Responsive ---------- */

        /* Tablet: hide edge nav buttons */
        @media (max-width: 768px) {
          .pagination-inner {
            padding: 10px 12px;
            gap: 8px;
          }
          .nav-btn-edge {
            display: none;
          }
        }

        /* Small: stack layout */
        @media (max-width: 540px) {
          .pagination-inner {
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 12px;
          }
          .pagination-left {
            width: 100%;
            justify-content: center;
          }
          .jump-form {
            order: 3;
          }
        }
      `}</style>
    </div>
  );
};

export default Pagination;

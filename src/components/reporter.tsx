// The Reporter: files a Report (bug or idea) as a Markdown file for an
// agent to work on later. Report Mode repurposes input — taps select
// elements as Targets instead of operating the app — and the compose
// modal turns Targets into Mention chips inside the note. Opened by
// Cmd/Ctrl+Shift+P on desktop or a shake on mobile (see use-shake.ts).
// Domain terms live in CONTEXT.md; the saved file format in
// src/server/reports.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ReportKind, ReportPayload } from "../domain/report";
import {
  buildSelector,
  buildSnippet,
  serializeNote,
} from "../lib/report-capture";
import { useShake } from "../lib/use-shake";
import { defaultTransport } from "../stores/default-transport";
import type { Transport } from "../stores/transport";
import { Icon } from "./ui";
import "./reporter.scss";

type Phase = "off" | "picking" | "composing";

type CapturedTarget = {
  id: string;
  tag: string;
  selector: string;
  snippet: string;
  el: Element;
};

type TargetRect = { id: string; rect: DOMRect };

const MOVE_TOLERANCE = 10;

const isReporterUi = (t: EventTarget | null): boolean =>
  t instanceof Element && t.closest("[data-reporter]") !== null;

const ComposeModal = ({
  targets,
  kind,
  setKind,
  initialNoteHtml,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  targets: CapturedTarget[];
  kind: ReportKind;
  setKind: (k: ReportKind) => void;
  initialNoteHtml: string;
  onCancel: (noteHtml: string) => void;
  onSubmit: (note: string, noteHtml: string) => void;
  submitting: boolean;
  error: string | null;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initialNoteHtml;
    editor.focus();
    // Draft restored imperatively once on mount; the editor is uncontrolled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertMention = (target: CapturedTarget) => {
    const editor = editorRef.current;
    if (!editor) return;
    const chip = document.createElement("span");
    chip.className = "mention-chip";
    chip.contentEditable = "false";
    chip.dataset.targetId = target.id;
    chip.textContent = `${target.id} · ${target.tag}`;

    editor.focus();
    const selection = window.getSelection();
    const range =
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.getRangeAt(0).commonAncestorContainer)
        ? selection.getRangeAt(0)
        : null;
    if (range) {
      range.deleteContents();
      range.insertNode(chip);
    } else {
      editor.appendChild(chip);
    }
    const space = document.createTextNode("\u00a0");
    chip.after(space);
    if (selection) {
      const caret = document.createRange();
      caret.setStartAfter(space);
      caret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caret);
    }
  };

  const currentHtml = () => editorRef.current?.innerHTML ?? "";

  const submit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onSubmit(serializeNote(editor), currentHtml());
  };

  return (
    <div
      className="reporter-modal-overlay"
      data-reporter
      onClick={() => onCancel(currentHtml())}
    >
      <div
        className="reporter-modal"
        role="dialog"
        aria-label="New report"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reporter-modal-header">
          <div className="reporter-kind-toggle" role="radiogroup">
            <button
              role="radio"
              aria-checked={kind === "bug"}
              className={`reporter-kind-btn ${kind === "bug" ? "active" : ""}`}
              onClick={() => setKind("bug")}
            >
              <Icon name="bug_report" /> Bug
            </button>
            <button
              role="radio"
              aria-checked={kind === "idea"}
              className={`reporter-kind-btn ${kind === "idea" ? "active" : ""}`}
              onClick={() => setKind("idea")}
            >
              <Icon name="lightbulb" /> Idea
            </button>
          </div>
          <button
            className="reporter-modal-close"
            onClick={() => onCancel(currentHtml())}
            aria-label="Back to picking"
          >
            <Icon name="close" />
          </button>
        </div>
        {targets.length > 0 && (
          <div className="reporter-target-row">
            {targets.map((t) => (
              <button
                key={t.id}
                className="reporter-target-btn"
                onClick={() => insertMention(t)}
                title={t.selector}
              >
                <span className="reporter-target-id">{t.id}</span> {t.tag}
              </button>
            ))}
          </div>
        )}
        <div
          ref={editorRef}
          className="reporter-note"
          contentEditable
          data-placeholder={
            targets.length > 0
              ? "Describe it — tap a target above to reference it…"
              : "Describe the bug or idea…"
          }
        />
        {error && <div className="reporter-error">{error}</div>}
        <button
          className="reporter-submit"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Save report"}
        </button>
      </div>
    </div>
  );
};

export const Reporter = ({
  currentTab,
  shakeEnabled,
  transport = defaultTransport,
}: {
  currentTab: string;
  shakeEnabled: boolean;
  transport?: Transport;
}) => {
  const [phase, setPhase] = useState<Phase>("off");
  const [targets, setTargets] = useState<CapturedTarget[]>([]);
  const [rects, setRects] = useState<TargetRect[]>([]);
  const [kind, setKind] = useState<ReportKind>("bug");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const noteDraftRef = useRef("");
  const location = useLocation();

  const exit = useCallback(() => {
    setPhase("off");
    setTargets([]);
    setError(null);
    noteDraftRef.current = "";
  }, []);

  const open = useCallback(() => {
    setPhase((p) => (p === "off" ? "picking" : p));
  }, []);

  useShake(shakeEnabled, open);

  // Desktop shortcut + Escape handling.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "KeyP") {
        e.preventDefault();
        setPhase((p) => {
          if (p !== "off") {
            // toggling off discards the session
            setTimeout(exit, 0);
            return p;
          }
          return "picking";
        });
        return;
      }
      if (e.key === "Escape") {
        setPhase((p) => {
          if (p === "composing") return "picking";
          if (p === "picking") {
            setTimeout(exit, 0);
            return p;
          }
          return p;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exit]);

  const toggleTargetAt = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    if (!el || isReporterUi(el)) return;
    if (el === document.documentElement) return;
    setTargets((prev) => {
      const existing = prev.find((t) => t.el === el);
      if (existing) return prev.filter((t) => t !== existing);
      // Reuse the lowest free number so deselecting a Target frees its id
      // instead of the counter climbing forever.
      const used = new Set(prev.map((t) => t.id));
      let n = 1;
      while (used.has(`t${n}`)) n++;
      const target: CapturedTarget = {
        id: `t${n}`,
        tag: el.tagName.toLowerCase(),
        selector: buildSelector(el),
        snippet: buildSnippet(el),
        el,
      };
      return [...prev, target];
    });
  }, []);

  // Report Mode input hijack: capture-phase listeners keep taps from
  // reaching the app (buttons, drag sensors) while native scrolling still
  // works. Selection happens on pointerup so a scroll-drag doesn't select.
  useEffect(() => {
    if (phase !== "picking") return;
    let downAt: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      if (isReporterUi(e.target)) return;
      downAt = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      e.stopPropagation();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (isReporterUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (
        downAt &&
        Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < MOVE_TOLERANCE
      ) {
        toggleTargetAt(e.clientX, e.clientY);
      }
      downAt = null;
    };
    const onClick = (e: MouseEvent) => {
      if (isReporterUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [phase, toggleTargetAt]);

  // Keep highlight boxes glued to their elements through scroll/resize.
  useEffect(() => {
    if (phase === "off") {
      setRects([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      setRects(
        targets
          .filter((t) => t.el.isConnected)
          .map((t) => ({ id: t.id, rect: t.el.getBoundingClientRect() }))
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [phase, targets]);

  const submit = async (note: string, noteHtml: string) => {
    if (!note && targets.length === 0) {
      setError("Add a note or select at least one element.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: ReportPayload = {
      kind,
      note,
      context: {
        tab: currentTab,
        url: location.pathname,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        userAgent: navigator.userAgent,
      },
      targets: targets.map(({ id, tag, selector, snippet }) => ({
        id,
        tag,
        selector,
        snippet,
      })),
    };
    try {
      await transport.post("/api/reports", payload);
      exit();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      noteDraftRef.current = noteHtml;
      setError("Couldn't save the report — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "off") {
    return savedFlash ? (
      <div className="reporter-saved-flash" data-reporter>
        <Icon name="check_circle" /> Report saved
      </div>
    ) : null;
  }

  return (
    <>
      <div className="reporter-dim" />
      {rects.map(({ id, rect }) => (
        <div
          key={id}
          className="reporter-highlight"
          style={{
            top: rect.top - 3,
            left: rect.left - 3,
            width: rect.width + 6,
            height: rect.height + 6,
          }}
        >
          <span className="reporter-highlight-label">{id}</span>
        </div>
      ))}
      <div className="reporter-fabs" data-reporter>
        <button
          className="reporter-fab reporter-fab-close"
          onClick={exit}
          aria-label="Exit report mode"
        >
          <Icon name="close" />
        </button>
        <button
          className="reporter-fab reporter-fab-report"
          onClick={() => setPhase("composing")}
          aria-label="Write report"
        >
          <Icon name="bug_report" />
          {targets.length > 0 && (
            <span className="reporter-fab-badge">{targets.length}</span>
          )}
        </button>
      </div>
      {phase === "composing" && (
        <ComposeModal
          targets={targets}
          kind={kind}
          setKind={setKind}
          initialNoteHtml={noteDraftRef.current}
          onCancel={(noteHtml) => {
            noteDraftRef.current = noteHtml;
            setPhase("picking");
          }}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      )}
    </>
  );
};

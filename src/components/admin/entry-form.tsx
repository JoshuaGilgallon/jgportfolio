"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { contentTypes, type ContentType, type EntryValues, type Field, type SaveState } from "@/lib/admin/config";
import { HapticTap } from "@/components/haptic-tap";
import { ArrowUpRight, ChevronLeft } from "@/components/icons";
import s from "./admin.module.css";

const Preview = dynamic(() => import("./preview").then((m) => m.Preview), {
  loading: () => <div className={s.previewEmpty}>Loading preview…</div>,
});

type Props = {
  type: ContentType;
  values: EntryValues;
  action: (state: SaveState, formData: FormData) => Promise<SaveState>;
  onDelete?: () => Promise<void>;
  publicHref?: string;
};

export function EntryForm({ type, values, action, onDelete, publicHref }: Props) {
  const config = contentTypes[type];
  const isNew = !onDelete;
  // dirty when there are edits newer than the last save
  const [version, setVersion] = useState(0);
  const [state, formAction, pending] = useActionState<SaveState & { version?: number }, FormData>(
    async (prev, data) => ({
      ...(await action(prev, data)),
      version: Number(data.get("__version")),
    }),
    {},
  );
  const savedVersion = state.ok ? (state.version ?? 0) : 0;
  const dirty = version > savedVersion;
  const showSaved = !!state.savedAt && !dirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const title = isNew ? `New ${config.singular}` : String(values.title ?? values.label ?? `Edit ${config.singular}`);

  return (
    <main>
      <div className={s.editorHead}>
        <div className={s.editorNav}>
          <Link href={`/admin/${type}`} className={s.back}>
            <ChevronLeft /> {config.label}
          </Link>
          {publicHref && (
            <a href={publicHref} className={s.viewLink}>
              View on site <ArrowUpRight />
            </a>
          )}
        </div>
        <h1 className={s.title}>{title}</h1>
      </div>

      <form
        // manual submit stops react resetting the fields
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          data.set("__version", String(version));
          startTransition(() => formAction(data));
        }}
        onChange={() => setVersion((v) => v + 1)}
        className={s.form}
        noValidate
      >
        <div className={s.fields}>
          {config.fields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              defaultValue={values[field.name]}
              error={state.fieldErrors?.[field.name]}
            />
          ))}
        </div>

        <div className={s.saveBar}>
          <div className={`${s.page} ${s.saveInner}`}>
            {onDelete ? <DeleteButton onDelete={onDelete} label={`Delete ${config.singular}`} /> : <span />}
            <div className={s.saveRight}>
              <span className={s.status} role="status" aria-live="polite">
                {state.error ? (
                  <span className={s.statusError}>{state.error}</span>
                ) : showSaved ? (
                  <span key={state.savedAt} className={s.saved}>
                    Saved
                  </span>
                ) : dirty ? (
                  "Unsaved changes"
                ) : null}
              </span>
              <button type="submit" className={s.primary} disabled={pending}>
                {pending ? "Saving…" : isNew ? "Create" : "Save"}
                <HapticTap />
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}

function FieldControl({ field, defaultValue, error }: { field: Field; defaultValue?: string | boolean; error?: string }) {
  const id = `f-${field.name}`;
  const describedBy = [field.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: field.name,
    required: field.required,
    placeholder: field.placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  const str = typeof defaultValue === "string" ? defaultValue : "";

  if (field.type === "toggle") {
    return (
      <div className={`${s.field} ${s.toggleField} sq`}>
        <span className={s.toggleText}>
          <label htmlFor={id} className={s.toggleLabel}>
            {field.label}
          </label>
          {field.hint && (
            <span id={`${id}-hint`} className={s.hint}>
              {field.hint}
            </span>
          )}
        </span>
        <input
          id={id}
          name={field.name}
          type="checkbox"
          role="switch"
          className={s.switch}
          defaultChecked={defaultValue === true}
        />
      </div>
    );
  }

  return (
    <div className={`${s.field} ${field.half ? s.half : ""}`}>
      <label htmlFor={id} className={s.label}>
        {field.label}
      </label>
      {field.type === "markdown" ? (
        <MarkdownField {...common} defaultValue={str} />
      ) : field.type === "textarea" ? (
        <textarea {...common} defaultValue={str} rows={2} className={`${s.input} ${s.textarea} sq`} />
      ) : field.type === "select" ? (
        <select {...common} defaultValue={str} className={`${s.input} ${s.select} sq`}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === "url" ? "url" : field.type === "date" ? "date" : "text"}
          defaultValue={str}
          className={`${s.input} sq`}
          spellCheck={field.name === "slug" || field.type === "url" ? false : undefined}
          autoCapitalize={field.name === "slug" || field.type === "url" ? "none" : undefined}
        />
      )}
      {error ? (
        <span id={`${id}-error`} className={s.error}>
          {error}
        </span>
      ) : (
        field.hint && (
          <span id={`${id}-hint`} className={s.hint}>
            {field.hint}
          </span>
        )
      )}
    </div>
  );
}

function MarkdownField({ defaultValue, ...props }: React.ComponentProps<"textarea"> & { defaultValue: string }) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [value, setValue] = useState(defaultValue);

  return (
    <div className={s.markdown}>
      <div className={`${s.segmented} sq`} role="tablist" aria-label="Editor mode">
        {(["write", "preview"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`${s.segment} sq ${mode === m ? s.segmentActive : ""}`}
            onClick={() => setMode(m)}
          >
            {m === "write" ? "Write" : "Preview"}
            <HapticTap />
          </button>
        ))}
      </div>
      <textarea
        {...props}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hidden={mode !== "write"}
        className={`${s.input} ${s.code} sq`}
        spellCheck
        placeholder="Write in Markdown…"
      />
      {mode === "preview" && (
        <div className={`${s.preview} sq`}>
          {value.trim() ? <Preview markdown={value} /> : <div className={s.previewEmpty}>Nothing to preview.</div>}
        </div>
      )}
    </div>
  );
}

function DeleteButton({ onDelete, label }: { onDelete: () => Promise<void>; label: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={`${s.danger} ${armed ? s.dangerArmed : ""}`}
      disabled={pending}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setPending(true);
        await onDelete();
      }}
    >
      {pending ? "Deleting…" : armed ? "Tap again to delete" : label}
      <HapticTap />
    </button>
  );
}

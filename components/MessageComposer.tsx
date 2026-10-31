"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage } from "@/app/actions/comms";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(sendMessage, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      window.scrollTo({ top: document.body.scrollHeight });
    }
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <textarea
        name="body"
        rows={1}
        maxLength={4000}
        required
        placeholder="Message"
        aria-label="Message"
        className="input max-h-40 min-h-10 flex-1 resize-y"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button className="btn-primary" disabled={pending}>Send</button>
      {state?.error && <span role="alert" className="sr-only">{state.error}</span>}
    </form>
  );
}

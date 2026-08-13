import { useState, type FormEvent } from "react";

type Props = {
  onCreated: (id: string) => void;
};

export function CreateForm({ onCreated }: Props) {
  const [label, setLabel] = useState("");
  const [targetLocal, setTargetLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const targetAt = new Date(targetLocal).toISOString();
      const res = await fetch("/api/countdowns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, targetAt }),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "しばらく待ってから再度お試しください"
            : "登録に失敗しました",
        );
        return;
      }
      const { id } = (await res.json()) as { id: string };
      onCreated(id);
    } catch {
      setError("APIに接続できません");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <p className="lead">
        目標の日時とラベルを登録すると、共有URLが発行されます。
      </p>
      <form onSubmit={onSubmit} className="form">
        <label className="field">
          <span>ラベル</span>
          <input
            name="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
            required
            data-testid="label-input"
            placeholder="例: リリース日"
          />
        </label>
        <label className="field">
          <span>目標日時</span>
          <input
            name="target"
            type="datetime-local"
            value={targetLocal}
            onChange={(e) => setTargetLocal(e.target.value)}
            required
            data-testid="target-input"
          />
        </label>
        <button type="submit" disabled={submitting} data-testid="submit">
          共有URLを発行
        </button>
      </form>
      {error ? (
        <p className="error" data-testid="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

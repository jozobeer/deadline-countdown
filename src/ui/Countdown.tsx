import { useEffect, useState } from "react";
import { formatRemaining, type Remaining } from "./formatRemaining";

type CountdownData = { label: string; targetAt: string };

type Props = { id: string };

export function Countdown({ id }: Props) {
  const [data, setData] = useState<CountdownData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not_found" | "error">(
    "loading",
  );
  const [parts, setParts] = useState<Remaining | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/countdowns/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus("not_found");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const json = (await res.json()) as CountdownData;
        setData(json);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const tick = () => setParts(formatRemaining(data.targetAt, Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data]);

  if (status === "loading") {
    return <p className="status">読み込み中…</p>;
  }
  if (status === "not_found") {
    return (
      <p className="status" data-testid="not-found">
        見つかりません
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="error" data-testid="error" role="alert">
        読み込みに失敗しました
      </p>
    );
  }
  if (!data || !parts) return null;

  const shareUrl = `${location.origin}${location.pathname}#/c/${id}`;

  return (
    <section className="countdown" data-testid="countdown">
      <h2 className="countdown__label" data-testid="countdown-label">
        {data.label}
      </h2>
      {parts.overdue ? (
        <p className="countdown__overdue" data-testid="overdue">
          経過
        </p>
      ) : (
        <p className="countdown__remaining" aria-live="polite">
          <span className="unit">
            <span className="unit__value" data-testid="days">
              {parts.days}
            </span>
            <span className="unit__label">日</span>
          </span>
          <span className="unit">
            <span className="unit__value" data-testid="hours">
              {parts.hours}
            </span>
            <span className="unit__label">時間</span>
          </span>
          <span className="unit">
            <span className="unit__value" data-testid="minutes">
              {parts.minutes}
            </span>
            <span className="unit__label">分</span>
          </span>
        </p>
      )}
      <p className="share">
        共有URL:{" "}
        <a href={shareUrl} data-testid="share-url">
          {shareUrl}
        </a>
      </p>
      <p className="back">
        <a href="#/">新しく登録する</a>
      </p>
    </section>
  );
}

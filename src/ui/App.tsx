import { useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import { CreateForm } from "./CreateForm";
import "./app.css";

function parseCountdownId(hash: string): string | null {
  const match = /^#\/c\/([^/]+)$/.exec(hash);
  return match ? decodeURIComponent(match[1]) : null;
}

export function App() {
  const [hash, setHash] = useState(() => location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const id = parseCountdownId(hash);

  function goToCountdown(newId: string) {
    location.hash = `#/c/${newId}`;
  }

  return (
    <main className="app">
      <header className="hero">
        <h1 className="hero__title">共有カウントダウン</h1>
        <p className="hero__lead">
          締切や記念日までの残り時間を、URLひとつで共有できます。
        </p>
      </header>
      {id ? <Countdown id={id} /> : <CreateForm onCreated={goToCountdown} />}
    </main>
  );
}

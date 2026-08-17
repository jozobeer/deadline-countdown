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
      <div className="guide">
        <section aria-labelledby="how-to-heading">
          <h2 id="how-to-heading">使い方</h2>
          <ol>
            <li>ラベルと目標日時を入力し、「共有URLを発行」を押します。</li>
            <li>発行された共有URLを相手に送ります。</li>
            <li>同じURLを開いた人は、同じ残り日数・時間・分を見られます。</li>
          </ol>
        </section>
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading">FAQ</h2>
          <dl>
            <dt>タイムゾーンが違う相手と見ると、残り時間はずれますか？</dt>
            <dd>
              ずれません。目標日時はUTCで保存されるので、誰が見ても同じ瞬間を指します。
            </dd>
            <dt>期限を過ぎるとどうなりますか？</dt>
            <dd>「経過」と表示されます。</dd>
            <dt>登録した内容をあとから変えたり消したりできますか？</dt>
            <dd>
              できません。認証・編集・削除はありません。必要なときは新しく登録してください。
            </dd>
          </dl>
        </section>
      </div>
    </main>
  );
}

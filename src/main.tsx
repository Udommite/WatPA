import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
const Reports = React.lazy(() => import("./Reports"));
import {
  Package,
  LayoutDashboard,
  Plus,
  MapPin,
  Tags,
  ClipboardCheck,
  ArrowRightLeft,
  FileDown,
  Users,
  Settings,
  Search,
  RefreshCw,
  LogOut,
  X,
  Camera,
  ChevronRight,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  WifiOff,
} from "lucide-react";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "./style.css";
import * as store from "./store";
import {
  assetSchema,
  admin,
  writable,
  type RecordRow,
  type Operation,
} from "../shared/model";
const nav = [
  ["ภาพรวม", LayoutDashboard],
  ["ทะเบียนทรัพย์สิน", Package],
  ["เพิ่มทรัพย์สิน", Plus],
  ["หมวดหมู่ทรัพย์สิน", Tags],
  ["สถานที่จัดเก็บ", MapPin],
  ["ตรวจนับทรัพย์สิน", ClipboardCheck],
  ["ประวัติการเคลื่อนย้าย", ArrowRightLeft],
  ["รายงานและส่งออก", FileDown],
  ["ผู้ใช้งานและสิทธิ์", Users],
  ["ตั้งค่า", Settings],
] as const;
const labels: any = {
  active: "ใช้งานอยู่",
  review: "รอตรวจสอบ",
  disposed: "จำหน่ายแล้ว",
  good: "ปกติ",
  damaged: "ชำรุด",
  unusable: "ใช้การไม่ได้",
  missing: "สูญหาย",
  movable: "สังหาริมทรัพย์",
  immovable: "อสังหาริมทรัพย์",
  purchased: "ซื้อ",
  donated: "รับบริจาค",
  transferred: "รับโอน",
  other: "อื่น ๆ",
  found: "พบ",
  expected: "ยังไม่ตรวจ",
  local: "บันทึกในเครื่อง",
  syncing: "กำลังซิงก์",
  synced: "ซิงก์แล้ว",
  error: "ผิดพลาด",
};
const date = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function App() {
  const [user, setUser] = useState<any>(null),
    [page, setPage] = useState(0),
    [data, setData] = useState<RecordRow[]>([]),
    [pictures, setPictures] = useState<any[]>([]),
    [docs, setDocs] = useState<any[]>([]),
    [caption, setCaption] = useState(""),
    [ops, setOps] = useState<Operation[]>([]),
    [message, setMessage] = useState(""),
    [syncing, setSyncing] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [edit, setEdit] = useState<RecordRow | null | undefined>(undefined),
    [detail, setDetail] = useState<RecordRow | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [location, setLocation] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [sort, setSort] = useState("code"),
    [pg, setPg] = useState(1),
    [history, setHistory] = useState<any>(null),
    [members, setMembers] = useState<any[]>([]),
    [conflict, setConflict] = useState<Operation | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [showValue, setShowValue] = useState(false);
  const refresh = async () => {
    setData(await store.rows());
    setPictures(await store.photos());
    setDocs(await store.documents());
    setOps(await store.operations());
  };
  const run = async (fn: () => Promise<any>) => {
    try {
      await fn();
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  const sync = async () => {
    setSyncing(true);
    try {
      await store.sync(() => void refresh());
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
      if (e.status === 401 || e.status === 403) {
        await store.logout();
        setUser(null);
        setData([]);
        setPictures([]);
        setDocs([]);
      }
    } finally {
      setSyncing(false);
    }
  };
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    void refresh();
    void sync();
    const timer = setInterval(() => {
      if (Date.now() > Date.parse(user.offline_until)) {
        void store.logout();
        setUser(null);
        setData([]);
        setPictures([]);
        setDocs([]);
        setMessage("สิทธิ์ออฟไลน์หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
      } else void sync();
    }, 30000);
    return () => clearInterval(timer);
  }, [user, online]);
  const assets = data.filter((r) => r.kind === "asset"),
    cats = data.filter((r) => r.kind === "category"),
    locs = data.filter((r) => r.kind === "location");
  const pathName = (id: string, seen = new Set<string>()): string => {
    const r = locs.find((x) => x.id === id);
    if (!r || seen.has(id)) return "";
    seen.add(id);
    return (
      (r.data.parent_id ? pathName(r.data.parent_id, seen) + " / " : "") +
      r.data.name
    );
  };
  const catName = (id: string) =>
    cats.find((c) => c.id === id)?.data.name || "—";
  const filtered = assets
    .filter(
      (a) =>
        (!query ||
          [
            a.data.name,
            a.data.code,
            catName(a.data.category_id),
            pathName(a.data.location_id),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!category || a.data.category_id === category) &&
        (!location ||
          pathName(a.data.location_id).startsWith(pathName(location))) &&
        (!status || a.data.status === status || a.data.condition === status) &&
        (!type || a.data.type === type),
    )
    .sort((a, b) =>
      String(
        sort === "location" ? pathName(a.data.location_id) : a.data[sort],
      ).localeCompare(
        String(
          sort === "location" ? pathName(b.data.location_id) : b.data[sort],
        ),
        "th",
      ),
    );
  const openPage = (i: number) => {
    if (i === 2) {
      setEdit(null);
      return;
    }
    setPage(i);
    if (i === 8) void run(async () => setMembers(await store.api("/members")));
  };
  const save = async (
    kind: string,
    d: any,
    old?: RecordRow,
    reason?: string,
  ) => {
    const row = await store.save(kind, d, old, reason);
    await refresh();
    void sync();
    return row;
  };
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            temple: user.temple_name,
            records: selected.length
              ? data.filter((d) => selected.includes(d.id))
              : data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "watassets-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!user)
    return (
      <div className="login">
        <div className="login-story">
          <img src="/icon.svg" />
          <span>WATASSETS</span>
          <h1>
            ดูแลทรัพย์สินวัด
            <br />
            ให้เป็นระบบ
            <br />
            <em>และส่งต่อได้อย่างมั่นใจ</em>
          </h1>
          <p>ทะเบียนทรัพย์สิน • ภาพถ่าย • สถานที่จัดเก็บ</p>
          <small>ข้อมูลของวัด เข้าถึงได้เฉพาะผู้ได้รับอนุญาต</small>
        </div>
        <form
          className="login-box"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const u = await store.login(
                String(f.get("email")),
                String(f.get("password")),
              );
              setUser(u);
              setMessage("");
            });
          }}
        >
          <div className="eyebrow">ยินดีต้อนรับ</div>
          <h2>เข้าสู่ระบบทะเบียนทรัพย์สินวัด</h2>
          <p>ใช้อีเมลและรหัสผ่านที่ผู้ดูแลวัดจัดเตรียมให้</p>
          <label>
            อีเมล
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            รหัสผ่าน
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button className="primary">
            เข้าสู่ระบบ / ปลดล็อกออฟไลน์ <ChevronRight size={18} />
          </button>
          {message && (
            <div role="alert" className="warning">
              {message}
            </div>
          )}
          <small>
            อุปกรณ์ที่เคยเข้าสู่ระบบสามารถปลดล็อกข้อมูลออฟไลน์ได้ภายใน 8 ชั่วโมง
            ข้อมูลในเครื่องเข้ารหัสด้วยรหัสผ่านของคุณ
          </small>
        </form>
      </div>
    );
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <img src="/icon.svg" />
          <div>
            WatAssets<small>ระบบทะเบียนทรัพย์สินวัด</small>
          </div>
        </div>
        <div className="temple">
          <Landmark size={22} />
          <div>
            {user.temple_name}
            <small>พื้นที่ทำงานของวัด</small>
          </div>
        </div>
        <small className="nav-label">จัดการทรัพย์สิน</small>
        <nav>
          {nav.map(([name, Icon], i) => (
            <button
              key={name}
              className={page === i ? "active" : ""}
              onClick={() => openPage(i)}
            >
              <Icon size={19} />
              {name}
              {i === 1 && <span>{assets.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{user.name[0]}</div>
          <div>
            {user.name}
            <small>{user.role}</small>
          </div>
          <button
            aria-label="ออกจากระบบ"
            onClick={() =>
              void run(async () => {
                await store.logout();
                setUser(null);
                setData([]);
                setPictures([]);
              })
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            พื้นที่ทำงาน <ChevronRight size={14} /> {nav[page][0]}
          </span>
          <button
            className={online ? "online" : "offline"}
            onClick={() => void sync()}
          >
            {online ? <Cloud size={16} /> : <WifiOff size={16} />}{" "}
            {syncing ? "กำลังซิงก์…" : online ? "เชื่อมต่อแล้ว" : "ออฟไลน์"}
            {ops.length > 0 && ` · รอซิงก์ ${ops.length}`}
          </button>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">WATASSETS / ASSET MANAGEMENT</div>
              <h1>{nav[page][0]}</h1>
              <p>
                {page === 0
                  ? "มองเห็นทรัพย์สินทุกชิ้น ดูแลได้อย่างทั่วถึง"
                  : "จัดเก็บ ค้นหา และตรวจสอบข้อมูลทรัพย์สินของวัด"}
              </p>
            </div>
            {writable(user.role) && (
              <button className="primary" onClick={() => setEdit(null)}>
                <Plus size={18} />
                เพิ่มทรัพย์สิน
              </button>
            )}
          </div>
          {message && (
            <div role="alert" className="warning">
              {message}
              <button aria-label="ปิดข้อความ" onClick={() => setMessage("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {ops.some((o) => o.conflict) && (
            <div className="warning">
              พบข้อมูลขัดแย้ง กรุณาเลือกข้อมูลที่ต้องการเก็บ{" "}
              {ops
                .filter((o) => o.conflict)
                .map((o) => (
                  <button key={o.id} onClick={() => setConflict(o)}>
                    ตรวจสอบ {o.data.name}
                  </button>
                ))}
            </div>
          )}
          {page === 0 && (
            <>
              <section className="welcome">
                <div>
                  <span className="eyebrow">
                    ทะเบียนที่เป็นปัจจุบัน เริ่มจากการดูแลทุกวัน
                  </span>
                  <h2>ทุกทรัพย์สิน มีที่มาและที่อยู่</h2>
                  <p>
                    บันทึกภาพ จัดหมวดหมู่ และตรวจนับได้ แม้ไม่มีอินเทอร์เน็ต
                  </p>
                  <button onClick={() => setPage(1)}>
                    เปิดทะเบียนทรัพย์สิน <ChevronRight size={17} />
                  </button>
                </div>
                <Landmark size={116} strokeWidth={0.7} />
              </section>
              <div className="stats">
                {[
                  [
                    "ทรัพย์สินในทะเบียน",
                    assets.filter((a) => a.data.status !== "disposed").length,
                    "รายการที่ยังไม่จำหน่าย",
                  ],
                  [
                    "สังหาริมทรัพย์",
                    assets.filter((a) => a.data.type === "movable").length,
                    "พระพุทธรูป อุปกรณ์ และครุภัณฑ์",
                  ],
                  [
                    "อสังหาริมทรัพย์",
                    assets.filter((a) => a.data.type === "immovable").length,
                    "ที่ดิน อาคาร และสิ่งปลูกสร้าง",
                  ],
                  [
                    "ต้องตรวจสอบ",
                    assets.filter(
                      (a) =>
                        a.data.status === "review" ||
                        a.data.condition !== "good",
                    ).length,
                    "รอตรวจสอบ ชำรุด หรือสูญหาย",
                  ],
                ].map(([t, n, h], i) => (
                  <article key={t}>
                    <div className="stat-label">
                      {t}
                      {i === 3 ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <Package size={18} />
                      )}
                    </div>
                    <strong>
                      {n}
                      <small> รายการ</small>
                    </strong>
                    <small>{h}</small>
                  </article>
                ))}
              </div>
              <div className="two-col">
                <section className="panel">
                  <h3>ทรัพย์สินตามหมวดหมู่</h3>
                  {cats.map((c) => {
                    const count = assets.filter(
                      (a) => a.data.category_id === c.id,
                    ).length;
                    return (
                      <div className="bar-row" key={c.id}>
                        <span>{c.data.name}</span>
                        <strong>{count}</strong>
                        <div>
                          <i
                            style={{
                              width: `${(count / Math.max(1, assets.length)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </section>
                <section className="panel">
                  <h3>สถานที่จัดเก็บ</h3>
                  {locs
                    .filter((l) => !l.data.parent_id)
                    .map((l) => (
                      <button
                        className="location-row"
                        key={l.id}
                        onClick={() => {
                          setLocation(l.id);
                          setPage(1);
                        }}
                      >
                        <MapPin size={20} />
                        <span>
                          {l.data.name}
                          <small>
                            {
                              assets.filter((a) =>
                                pathName(a.data.location_id).startsWith(
                                  pathName(l.id),
                                ),
                              ).length
                            }{" "}
                            รายการ
                          </small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                </section>
              </div>
            </>
          )}
          {(page === 0 || page === 1) && (
            <section className="panel registry">
              <div className="section-heading">
                <h3>
                  {page === 0 ? "ทะเบียนทรัพย์สินล่าสุด" : "รายการทรัพย์สิน"}{" "}
                  <small>{filtered.length} รายการ</small>
                </h3>
                <button onClick={download}>
                  <FileDown size={16} />
                  ส่งออกข้อมูล
                </button>
              </div>
              <div className="filters">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="ค้นหาทรัพย์สิน"
                    placeholder="ค้นหาชื่อ รหัส หมวดหมู่ หรือสถานที่…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPg(1);
                    }}
                  />
                </div>
                <select
                  aria-label="ประเภท"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setPg(1);
                  }}
                >
                  <option value="">ทุกประเภท</option>
                  <option value="movable">สังหาริมทรัพย์</option>
                  <option value="immovable">อสังหาริมทรัพย์</option>
                </select>
                <select
                  aria-label="หมวดหมู่"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPg(1);
                  }}
                >
                  <option value="">ทุกหมวดหมู่</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.data.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="สถานที่"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setPg(1);
                  }}
                >
                  <option value="">ทุกสถานที่</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {pathName(l.id)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="สถานะ"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPg(1);
                  }}
                >
                  <option value="">ทุกสถานะ</option>
                  {["active", "review", "disposed", "damaged", "missing"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="table-options">
                <label>
                  <input
                    type="checkbox"
                    checked={showValue}
                    onChange={(e) => setShowValue(e.target.checked)}
                  />
                  แสดงมูลค่า
                </label>
                <label>
                  เรียงตาม{" "}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="code">รหัส</option>
                    <option value="name">ชื่อ</option>
                    <option value="location">สถานที่</option>
                  </select>
                </label>
                <small>เลือก {selected.length} รายการ</small>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          aria-label="เลือกหน้าปัจจุบัน"
                          type="checkbox"
                          checked={
                            filtered.length > 0 &&
                            filtered
                              .slice((pg - 1) * 10, pg * 10)
                              .every((a) => selected.includes(a.id))
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? filtered
                                    .slice((pg - 1) * 10, pg * 10)
                                    .map((a) => a.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      <th>รูปภาพ</th>
                      <th>รหัส / ชื่อทรัพย์สิน</th>
                      <th>หมวดหมู่</th>
                      <th>จำนวน</th>
                      <th>สถานที่จัดเก็บ</th>
                      <th>สถานะ</th>
                      {showValue && <th>มูลค่าต่อหน่วย</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice((pg - 1) * 10, pg * 10).map((a) => (
                      <tr key={a.id}>
                        <td>
                          <input
                            aria-label={"เลือก " + a.data.name}
                            type="checkbox"
                            checked={selected.includes(a.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, a.id]
                                  : selected.filter((id) => id !== a.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <Photo asset={a} photos={pictures} />
                        </td>
                        <td>
                          <button
                            className="asset-name"
                            onClick={() => {
                              setDetail(a);
                              setHistory(null);
                            }}
                          >
                            <small>{a.data.code}</small>
                            {a.data.name}
                          </button>
                        </td>
                        <td>{catName(a.data.category_id)}</td>
                        <td>
                          {a.data.quantity} <small>{a.data.unit}</small>
                        </td>
                        <td>
                          <span className="location-cell">
                            <MapPin size={14} />
                            {pathName(a.data.location_id)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              "badge " +
                              (a.data.condition === "good"
                                ? a.data.status
                                : "review")
                            }
                          >
                            {
                              labels[
                                a.data.condition === "good"
                                  ? a.data.status
                                  : a.data.condition
                              ]
                            }
                          </span>
                          {ops.some((o) => o.entity_id === a.id) && (
                            <small className="pending">รอซิงก์</small>
                          )}
                        </td>
                        {showValue && (
                          <td>
                            {a.data.value === null
                              ? "ไม่ทราบ"
                              : Number(a.data.value).toLocaleString("th-TH") +
                                " บาท"}
                          </td>
                        )}
                        <td>
                          <button
                            aria-label="ดูรายละเอียด"
                            onClick={() => {
                              setDetail(a);
                              setHistory(null);
                            }}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="empty">
                    <Package />
                    <h3>ยังไม่มีรายการที่ตรงกับการค้นหา</h3>
                    <p>ลองเปลี่ยนตัวกรอง หรือเพิ่มทรัพย์สินรายการแรก</p>
                  </div>
                )}
              </div>
              <div className="pagination">
                <small>
                  แสดง {Math.min(filtered.length, (pg - 1) * 10 + 1)}–
                  {Math.min(pg * 10, filtered.length)} จาก {filtered.length}{" "}
                  รายการ
                </small>
                <button disabled={pg === 1} onClick={() => setPg(pg - 1)}>
                  ก่อนหน้า
                </button>
                <span>{pg}</span>
                <button
                  disabled={pg * 10 >= filtered.length}
                  onClick={() => setPg(pg + 1)}
                >
                  ถัดไป
                </button>
              </div>
            </section>
          )}
          {(page === 3 || page === 4) && (
            <Taxonomy
              kind={page === 3 ? "category" : "location"}
              rows={page === 3 ? cats : locs}
              canEdit={admin(user.role)}
              save={save}
              run={run}
              pathName={pathName}
              assets={assets}
              onLocation={(id: string) => {
                setLocation(id);
                setPage(1);
              }}
            />
          )}
          {page === 5 && (
            <Inventory
              assets={assets}
              sessions={data.filter((r) => r.kind === "inventory")}
              save={save}
              run={run}
              canEdit={writable(user.role)}
            />
          )}
          {page === 6 && (
            <section className="panel">
              <h3>ประวัติการเคลื่อนย้ายและแก้ไข</h3>
              <p>
                เลือกรายการเพื่อเรียกประวัติจากฐานข้อมูลกลาง
                ต้องเชื่อมต่ออินเทอร์เน็ต
              </p>
              {assets.map((a) => (
                <button
                  className="location-row"
                  key={a.id}
                  onClick={() => {
                    setDetail(a);
                    void run(async () =>
                      setHistory(await store.api("/history/" + a.id)),
                    );
                  }}
                >
                  <ArrowRightLeft size={18} />
                  {a.data.code} — {a.data.name}
                  <ChevronRight size={18} />
                </button>
              ))}
            </section>
          )}
          {page === 7 && (
            <React.Suspense fallback={<p>กำลังเปิดระบบรายงาน…</p>}>
              <Reports
                records={data}
                temple={user.temple_name}
                locationName={pathName}
                photos={pictures}
                canEdit={writable(user.role)}
                onChange={async () => {
                  await refresh();
                  void sync();
                }}
              />
            </React.Suspense>
          )}
          {page === 8 && (
            <section className="panel">
              <h3>ผู้ใช้งานและสิทธิ์</h3>
              {admin(user.role) ? (
                <>
                  <form
                    className="member-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const d = Object.fromEntries(new FormData(form));
                      void run(async () => {
                        await store.api("/members", {
                          method: "POST",
                          body: JSON.stringify(d),
                        });
                        setMembers(await store.api("/members"));
                        form.reset();
                      });
                    }}
                  >
                    <input
                      name="name"
                      aria-label="ชื่อผู้ใช้"
                      placeholder="ชื่อผู้ใช้"
                      required
                    />
                    <input
                      name="email"
                      type="email"
                      aria-label="อีเมล"
                      placeholder="อีเมล"
                      required
                    />
                    <input
                      name="password"
                      type="password"
                      aria-label="รหัสผ่านเริ่มต้น"
                      placeholder="รหัสผ่านอย่างน้อย 12 ตัวอักษร"
                      minLength={12}
                      required
                    />
                    <select name="role">
                      <option value="staff">เจ้าหน้าที่บันทึก</option>
                      <option value="manager">ไวยาวัจกร</option>
                      <option value="approver">เจ้าอาวาส / ผู้อนุมัติ</option>
                      <option value="viewer">
                        ผู้ตรวจสอบ / อ่านอย่างเดียว
                      </option>
                      <option value="temple_admin">ผู้ดูแลวัด</option>
                    </select>
                    <button className="primary">เพิ่มผู้ใช้</button>
                  </form>
                  {members.map((m) => (
                    <div className="location-row" key={m.id}>
                      <span>
                        {m.name}
                        <small>{m.email}</small>
                      </span>
                      <span>
                        {m.role} · {m.active ? "ใช้งาน" : "เพิกถอนแล้ว"}
                      </span>
                      {m.id !== user.id && m.active && (
                        <button
                          onClick={() =>
                            void run(async () => {
                              await store.api("/members/" + m.id + "/revoke", {
                                method: "POST",
                              });
                              setMembers(await store.api("/members"));
                            })
                          }
                        >
                          เพิกถอนสิทธิ์
                        </button>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <p>เฉพาะผู้ดูแลวัดสามารถจัดการผู้ใช้ได้</p>
              )}
            </section>
          )}
          {page === 9 && (
            <section className="panel">
              <h3>อุปกรณ์และการซิงก์</h3>
              <p>
                ข้อมูลในเครื่องเข้ารหัส AES-GCM ปลดล็อกด้วยรหัสผ่าน
                การเข้าถึงออฟไลน์มีอายุ 8 ชั่วโมงหลังตรวจสอบสิทธิ์กับเซิร์ฟเวอร์
              </p>
              <p>
                รายการที่บันทึกออฟไลน์จะปรากฏให้ผู้อื่นเห็นหลังซิงก์สำเร็จเท่านั้น
              </p>
              <button className="primary" onClick={() => void sync()}>
                <RefreshCw size={18} />
                ซิงก์ตอนนี้
              </button>
              {ops.map((o) => (
                <div className="location-row" key={o.id}>
                  <span>
                    {o.data.name || o.entity_id}
                    <small>{o.error || "รอส่งข้อมูล"}</small>
                  </span>
                  <span>รุ่นฐาน {o.base_revision}</span>
                </div>
              ))}
              <p>
                รูปภาพรอซิงก์:{" "}
                {pictures.filter((p) => p.status !== "synced").length} รูป
              </p>
              <small>
                เครื่องสูญหาย: ให้ผู้ดูแลเพิกถอนสิทธิ์และยกเลิกเซสชัน
                อุปกรณ์ที่ขาดการเชื่อมต่อจะทราบการเพิกถอนเมื่อเชื่อมต่ออีกครั้งหรือหมดอายุออฟไลน์
              </small>
            </section>
          )}
          <footer>
            WatAssets · ระบบทะเบียนทรัพย์สินวัด{" "}
            <span>ข้อมูลสาธิตแสดงด้วยรหัส DEMO</span>
          </footer>
        </main>
      </div>
      {edit !== undefined && (
        <AssetForm
          old={edit}
          cats={cats}
          locs={locs}
          pathName={pathName}
          onClose={() => setEdit(undefined)}
          onSave={async (d, files, reason) => {
            const row = await store.save(
              "asset",
              assetSchema.parse(d),
              edit || undefined,
              reason,
            );
            for (const f of files) await store.addPhoto(row.id, f, "");
            setEdit(undefined);
            await refresh();
            void sync();
          }}
        />
      )}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <section className="drawer" onClick={(e) => e.stopPropagation()}>
            <button
              className="close"
              aria-label="ปิด"
              onClick={() => setDetail(null)}
            >
              <X />
            </button>
            <div className="eyebrow">รายละเอียดทรัพย์สิน</div>
            <h2>{detail.data.name}</h2>
            <p>
              {detail.data.code} · รุ่น {detail.revision}
            </p>
            <div className="gallery">
              {pictures
                .filter((p) => p.asset_id === detail.id)
                .map((p) => (
                  <figure key={p.id}>
                    <img src={p.data} />
                    <figcaption>
                      {p.caption || "ภาพทรัพย์สิน"} · {labels[p.status]}
                    </figcaption>
                    {writable(user.role) && (
                      <button
                        onClick={() =>
                          void run(async () => {
                            const current = data.find(
                              (r) => r.id === detail.id,
                            )!;
                            const row = await save(
                              "asset",
                              {
                                ...current.data,
                                metadata: {
                                  ...current.data.metadata,
                                  primary_image_id: p.id,
                                },
                              },
                              current,
                            );
                            setDetail(row);
                          })
                        }
                      >
                        {detail.data.metadata?.primary_image_id === p.id
                          ? "ภาพหลัก"
                          : "ใช้เป็นภาพหลัก"}
                      </button>
                    )}
                  </figure>
                ))}
              {!pictures.some((p) => p.asset_id === detail.id) && (
                <div className="empty">
                  <Camera />
                  <p>ยังไม่มีภาพถ่าย</p>
                </div>
              )}
            </div>
            <dl>
              {[
                ["ประเภท", labels[detail.data.type]],
                ["หมวดหมู่", catName(detail.data.category_id)],
                ["สถานที่", pathName(detail.data.location_id)],
                ["จำนวน", detail.data.quantity + " " + detail.data.unit],
                [
                  "มูลค่าต่อหน่วย",
                  detail.data.value === null
                    ? "ไม่ทราบ"
                    : detail.data.value + " บาท",
                ],
                [
                  "วันที่ได้มา",
                  detail.data.acquisition_date
                    ? date(detail.data.acquisition_date)
                    : "ไม่ทราบ",
                ],
                ["วิธีได้มา", labels[detail.data.acquisition_method]],
                ["แหล่งที่มา", detail.data.source],
                ["ผู้รับผิดชอบ", detail.data.custodian],
                ["รายละเอียด", detail.data.description],
                ["หมายเหตุ", detail.data.notes],
                ["ปรับปรุงล่าสุด", date(detail.updated_at)],
              ].map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "—"}</dd>
                </React.Fragment>
              ))}
            </dl>
            {writable(user.role) && (
              <>
                <button
                  className="primary"
                  onClick={() => {
                    setEdit(detail);
                    setDetail(null);
                  }}
                >
                  แก้ไข / ย้ายสถานที่
                </button>
                <label>
                  คำบรรยายภาพใหม่
                  <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <label className="upload">
                  เพิ่มภาพถ่าย
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) =>
                      void run(async () => {
                        for (const f of Array.from(e.target.files || []))
                          await store.addPhoto(detail.id, f, caption);
                        await refresh();
                        void sync();
                      })
                    }
                  />
                </label>
              </>
            )}
            <h3>เอกสารประกอบ</h3>
            {docs
              .filter((d) => d.asset_id === detail.id)
              .map((d) => (
                <p key={d.id}>
                  <a href={d.data} download={d.name}>
                    {d.name}
                  </a>{" "}
                  · {labels[d.status]}
                </p>
              ))}
            {writable(user.role) && (
              <label className="upload">
                แนบ PDF (ไม่เกิน 15 MB)
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) =>
                    void run(async () => {
                      for (const f of Array.from(e.target.files || []))
                        await store.addDocument(detail.id, f);
                      await refresh();
                      void sync();
                    })
                  }
                />
              </label>
            )}
            <button
              onClick={() =>
                void run(async () =>
                  setHistory(await store.api("/history/" + detail.id)),
                )
              }
            >
              ดูประวัติจากส่วนกลาง
            </button>
            {history && (
              <>
                <h3>ประวัติการย้าย</h3>
                {history.transfers.map((t: any) => (
                  <p key={t.id}>
                    {pathName(t.from_location)} → {pathName(t.to_location)}
                    <br />
                    <small>
                      {date(t.created_at)} · {t.reason}
                    </small>
                  </p>
                ))}
                <h3>ประวัติแก้ไข</h3>
                {history.audit.map((a: any) => (
                  <details key={a.id}>
                    <summary>
                      {date(a.created_at)} · {a.operator} · {a.action}
                    </summary>
                    <pre>
                      {JSON.stringify(
                        { before: a.before_data, after: a.after_data },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
              </>
            )}
          </section>
        </div>
      )}
      {conflict && (
        <Conflict
          op={conflict}
          close={() => setConflict(null)}
          submit={(d) =>
            void run(async () => {
              await store.resolve(conflict, d);
              setConflict(null);
              await refresh();
              void sync();
            })
          }
        />
      )}
    </div>
  );
}
function Photo({ asset, photos }: { asset: RecordRow; photos: any[] }) {
  const p =
    photos.find((p) => p.id === asset.data.metadata?.primary_image_id) ||
    photos.find((p) => p.asset_id === asset.id);
  return p ? (
    <img className="thumb" src={p.data} alt={asset.data.name} />
  ) : (
    <div className="placeholder">
      <Package size={22} />
      <small>{asset.data.code.startsWith("DEMO") ? "สาธิต" : "ไม่มีรูป"}</small>
    </div>
  );
}
function AssetForm({
  old,
  cats,
  locs,
  pathName,
  onClose,
  onSave,
}: {
  old: RecordRow | null;
  cats: RecordRow[];
  locs: RecordRow[];
  pathName: (id: string) => string;
  onClose: () => void;
  onSave: (d: any, f: File[], r: string) => Promise<void>;
}) {
  const [d, setD] = useState<any>(
      old?.data || {
        code: "WA-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        name: "",
        type: "movable",
        category_id: "",
        location_id: "",
        quantity: 1,
        unit: "ชิ้น",
        value: null,
        acquisition_date: null,
        acquisition_method: "donated",
        source: "",
        description: "",
        custodian: "",
        condition: "good",
        status: "active",
        notes: "",
        official: {},
        metadata: {},
      },
    ),
    [files, setFiles] = useState<File[]>([]),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const field = (k: string, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        required={["code", "name", "quantity", "unit"].includes(k)}
        min={k === "quantity" ? "0.001" : k === "value" ? "0" : undefined}
        step="any"
        value={d[k] ?? ""}
        onChange={(e) =>
          setD({
            ...d,
            [k]:
              type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : type === "date"
                  ? e.target.value || null
                  : e.target.value,
          })
        }
      />
    </label>
  );
  return (
    <div className="overlay">
      <section className="modal">
        <button className="close" aria-label="ปิด" onClick={onClose}>
          <X />
        </button>
        <div className="eyebrow">ASSET REGISTRATION</div>
        <h2>{old ? "แก้ไขข้อมูลทรัพย์สิน" : "เพิ่มทรัพย์สินใหม่"}</h2>
        <p>บันทึกลงอุปกรณ์ก่อน แล้วซิงก์เข้าสู่ทะเบียนกลาง</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSave(d, files, reason);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            {field("code", "รหัสทรัพย์สิน *")}
            {field("name", "ชื่อทรัพย์สิน *")}
            <label>
              ประเภท
              <select
                value={d.type}
                onChange={(e) =>
                  setD({ ...d, type: e.target.value, category_id: "" })
                }
              >
                {["movable", "immovable"].map((t) => (
                  <option key={t} value={t}>
                    {labels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              หมวดหมู่ *
              <select
                required
                value={d.category_id}
                onChange={(e) => setD({ ...d, category_id: e.target.value })}
              >
                <option value="">เลือกหมวดหมู่</option>
                {cats
                  .filter((c) => c.data.type === d.type && c.data.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.data.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              สถานที่จัดเก็บ *
              <select
                required
                value={d.location_id}
                onChange={(e) => setD({ ...d, location_id: e.target.value })}
              >
                <option value="">เลือกสถานที่</option>
                {locs
                  .filter((l) => l.data.active)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {pathName(l.id)}
                    </option>
                  ))}
              </select>
            </label>
            {field("custodian", "ผู้รับผิดชอบ")}
            {field("quantity", "จำนวน *", "number")}
            {field("unit", "หน่วย *")}
            {field("value", "มูลค่าต่อหน่วย (เว้นว่างหากไม่ทราบ)", "number")}
            {field("acquisition_date", "วันที่ได้มา (ค.ศ. ในช่องกรอก)", "date")}
            <label>
              วิธีได้มา
              <select
                value={d.acquisition_method}
                onChange={(e) =>
                  setD({ ...d, acquisition_method: e.target.value })
                }
              >
                {["donated", "purchased", "transferred", "other"].map((t) => (
                  <option key={t} value={t}>
                    {labels[t]}
                  </option>
                ))}
              </select>
            </label>
            {field("source", "ผู้บริจาค / แหล่งที่มา")}
            <label>
              สภาพ
              <select
                value={d.condition}
                onChange={(e) => setD({ ...d, condition: e.target.value })}
              >
                {["good", "damaged", "missing", "unusable"].map((t) => (
                  <option key={t} value={t}>
                    {labels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              สถานะ
              <select
                value={d.status}
                onChange={(e) => setD({ ...d, status: e.target.value })}
              >
                <option value="active">ใช้งานอยู่</option>
                <option value="review">รอตรวจสอบ</option>
              </select>
            </label>
            {(cats.find((c) => c.id === d.category_id)?.data.fields || []).map(
              (f: string) => (
                <label key={f}>
                  {f}
                  <input
                    value={d.metadata[f] || ""}
                    onChange={(e) =>
                      setD({
                        ...d,
                        metadata: { ...d.metadata, [f]: e.target.value },
                      })
                    }
                  />
                </label>
              ),
            )}
          </div>
          <label>
            รายละเอียด
            <textarea
              value={d.description}
              onChange={(e) => setD({ ...d, description: e.target.value })}
            />
          </label>
          <label>
            หมายเหตุ
            <textarea
              value={d.notes}
              onChange={(e) => setD({ ...d, notes: e.target.value })}
            />
          </label>
          {old && old.data.location_id !== d.location_id && (
            <label>
              เหตุผลการย้าย * (ไม่ใช่การโอนกรรมสิทธิ์)
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <details>
            <summary>ข้อมูลสำหรับทะเบียนทางการ</summary>
            <div className="form-grid">
              {[
                ["registration_number", "เลขที่ลงทะเบียน"],
                ["registration_date", "วันที่ลงทะเบียน (ค.ศ.)"],
                ["title_document", "หนังสือสำคัญ"],
                ["property_location", "ที่ตั้งทรัพย์สิน"],
                ["area", "เนื้อที่"],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <input
                    type={k === "registration_date" ? "date" : "text"}
                    value={d.official[k] || ""}
                    onChange={(e) =>
                      setD({
                        ...d,
                        official: { ...d.official, [k]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <label className="upload">
            <Camera />
            ถ่ายหรือเลือกภาพถ่าย ({files.length} รูป)
            <input
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) =>
                setFiles([...files, ...Array.from(e.target.files || [])])
              }
            />
            <small>ภาพจะย่อขนาดและเก็บแบบเข้ารหัสในเครื่อง</small>
          </label>
          {error && <p className="warning">{error}</p>}
          <div className="form-actions">
            <button type="button" onClick={onClose}>
              ยกเลิก
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกทรัพย์สิน"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function Taxonomy({
  kind,
  rows,
  canEdit,
  save,
  run,
  pathName,
  assets,
  onLocation,
}: any) {
  const [edit, setEdit] = useState<any>(null);
  return (
    <section className="panel">
      <h3>
        {kind === "category"
          ? "หมวดหมู่ที่ปรับได้ตามการใช้งาน"
          : "โครงสร้างสถานที่จัดเก็บ"}
      </h3>
      {canEdit && (
        <form
          key={edit?.id || "new"}
          className="member-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            void run(async () => {
              await save(
                kind,
                {
                  name: String(f.get("name")),
                  parent_id: f.get("parent_id") || null,
                  active: f.get("active") === "on",
                  ...(kind === "category"
                    ? {
                        type: f.get("type"),
                        fields: String(f.get("fields"))
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }
                    : {}),
                },
                edit || undefined,
              );
              setEdit(null);
              form.reset();
            });
          }}
        >
          <input
            name="name"
            aria-label="ชื่อ"
            placeholder="ชื่อหมวดหมู่ / สถานที่"
            required
            defaultValue={edit?.data.name}
          />
          <select name="parent_id" defaultValue={edit?.data.parent_id || ""}>
            <option value="">ระดับบนสุด</option>
            {rows
              .filter((r: any) => r.id !== edit?.id)
              .map((r: any) => (
                <option value={r.id} key={r.id}>
                  {r.data.name}
                </option>
              ))}
          </select>
          {kind === "category" && (
            <>
              <select name="type" defaultValue={edit?.data.type || "movable"}>
                <option value="movable">สังหาริมทรัพย์</option>
                <option value="immovable">อสังหาริมทรัพย์</option>
              </select>
              <input
                name="fields"
                placeholder="ช่องเพิ่มเติม คั่นด้วยจุลภาค"
                defaultValue={edit?.data.fields?.join(", ")}
              />
            </>
          )}
          <label>
            <input
              name="active"
              type="checkbox"
              defaultChecked={edit?.data.active ?? true}
            />
            ใช้งาน
          </label>
          <button className="primary">
            {edit ? "บันทึกแก้ไข" : "เพิ่มรายการ"}
          </button>
          {edit && (
            <button type="button" onClick={() => setEdit(null)}>
              ยกเลิก
            </button>
          )}
        </form>
      )}
      {rows.map((r: any) => (
        <div className="location-row" key={r.id}>
          {kind === "location" ? <MapPin size={20} /> : <Tags size={20} />}
          <span>
            {kind === "location" ? pathName(r.id) : r.data.name}
            <small>
              {r.data.active ? "ใช้งาน" : "ปิดใช้งาน"} ·{" "}
              {assets.filter((a: any) => a.data[kind + "_id"] === r.id).length}{" "}
              รายการ
            </small>
          </span>
          {kind === "location" && (
            <button onClick={() => onLocation(r.id)}>ดูทรัพย์สิน</button>
          )}
          {canEdit && <button onClick={() => setEdit(r)}>แก้ไข</button>}
        </div>
      ))}
    </section>
  );
}
function Inventory({ assets, sessions, save, run, canEdit }: any) {
  const [active, setActive] = useState<any>(null),
    [name, setName] = useState(""),
    [items, setItems] = useState<any>({});
  return (
    <section className="panel">
      <h3>ตรวจนับทรัพย์สิน</h3>
      {!active ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActive({ data: { name }, id: null });
              setItems(
                Object.fromEntries(
                  assets
                    .filter((a: any) => a.data.status !== "disposed")
                    .map((a: any) => [a.id, { result: "expected", note: "" }]),
                ),
              );
            }}
          >
            <label>
              ชื่อรอบตรวจนับ
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ตรวจนับประจำปี 2569"
              />
            </label>
            <button className="primary" disabled={!canEdit}>
              เริ่มตรวจนับ
            </button>
          </form>
          {sessions.map((s: any) => (
            <button
              className="location-row"
              key={s.id}
              onClick={() => {
                setActive(s);
                setName(s.data.name);
                setItems(s.data.items);
              }}
            >
              {s.data.name} ·{" "}
              {s.data.status === "completed" ? "เสร็จสิ้น" : "กำลังตรวจนับ"}
            </button>
          ))}
        </>
      ) : (
        <>
          <h3>{name || active.data.name}</h3>
          {Object.entries(items).map(([id, item]: any) => (
            <div className="location-row" key={id}>
              <span>
                {assets.find((a: any) => a.id === id)?.data.name || id}
              </span>
              <select
                disabled={!canEdit}
                value={item.result}
                onChange={(e) =>
                  setItems({
                    ...items,
                    [id]: { ...item, result: e.target.value },
                  })
                }
              >
                {["expected", "found", "missing", "damaged", "review"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {labels[t]}
                    </option>
                  ),
                )}
              </select>
              <input
                aria-label="หมายเหตุตรวจนับ"
                placeholder="หมายเหตุ"
                value={item.note}
                onChange={(e) =>
                  setItems({
                    ...items,
                    [id]: { ...item, note: e.target.value },
                  })
                }
              />
            </div>
          ))}
          {canEdit &&
            ["open", "completed"].map((status) => (
              <button
                key={status}
                className={status === "completed" ? "primary" : ""}
                onClick={() =>
                  void run(async () => {
                    if (
                      status === "completed" &&
                      Object.values(items).some(
                        (i: any) => i.result === "expected",
                      )
                    )
                      throw new Error("กรุณาตรวจให้ครบทุกรายการก่อนปิดรอบ");
                    await save(
                      "inventory",
                      {
                        name: name || active.data.name,
                        location_id: null,
                        status,
                        items,
                      },
                      active.id ? active : undefined,
                    );
                    setActive(null);
                  })
                }
              >
                {status === "open"
                  ? "บันทึกฉบับร่าง"
                  : "บันทึกและปิดรอบตรวจนับ"}
              </button>
            ))}
          <button onClick={() => setActive(null)}>กลับ</button>
        </>
      )}
    </section>
  );
}
function Conflict({
  op,
  submit,
  close,
}: {
  op: Operation;
  submit: (d: any) => void;
  close: () => void;
}) {
  const [d, setD] = useState({ ...op.conflict!.data });
  return (
    <div className="overlay">
      <section className="modal">
        <h2>แก้ไขข้อมูลขัดแย้ง</h2>
        <p>
          ทั้งสองรุ่นยังถูกเก็บไว้ เลือกค่าทีละช่องแล้วส่งใหม่ รุ่นกลาง{" "}
          {op.conflict!.revision}
        </p>
        {Object.keys(op.data)
          .filter(
            (k) =>
              JSON.stringify(op.data[k]) !==
              JSON.stringify(op.conflict!.data[k]),
          )
          .map((k) => (
            <fieldset key={k}>
              <legend>{k}</legend>
              {[
                ["จากเครื่องนี้", op.data[k]],
                ["จากส่วนกลาง", op.conflict!.data[k]],
              ].map(([label, value]) => (
                <label key={label}>
                  <input
                    type="radio"
                    name={k}
                    checked={JSON.stringify(d[k]) === JSON.stringify(value)}
                    onChange={() => setD({ ...d, [k]: value })}
                  />
                  {label}:{" "}
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value ?? "ไม่ทราบ")}
                </label>
              ))}
            </fieldset>
          ))}
        <button className="primary" onClick={() => submit(d)}>
          บันทึกข้อมูลที่เลือก
        </button>
        <button onClick={close}>ตรวจสอบภายหลัง</button>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

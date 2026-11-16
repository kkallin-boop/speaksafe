const SOP_PDF = "/static/sop-ppkpt.pdf";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const STAGES = ["Laporan terkirim", "Laporan diterima", "Selesai ditindak"];
const ITSB = /^[^@\s]+@([a-z0-9-]+\.)*itsb\.ac\.id$/;
let user = null,
  reports = [],
  sel = null,
  pending = null,
  cv = "login",
  stack = [];
const L = async (fn, ms = 700) => {
  $("#ld").classList.remove("hide");
  try {
    await Promise.all([fn(), new Promise((r) => setTimeout(r, ms))]);
  } catch (e) {
    console.error(e);
  } finally {
    $("#ld").classList.add("hide");
  }
};
async function api(path, method = "GET", body) {
  const o = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") {
    o.headers["Content-Type"] = "application/json";
    o.body = JSON.stringify(body || {});
  }
  let r;
  try {
    r = await fetch(path, o);
  } catch (e) {
    return { ok: false, status: 0, data: { error: "Tidak dapat terhubung ke server." } };
  }
  let d = {};
  try {
    d = await r.json();
  } catch (e) {}
  return { ok: r.ok, status: r.status, data: d };
}
async function loadReports() {
  const r = await api("/api/reports");
  if (r.ok) reports = r.data.reports;
  else if (r.status === 401) expire();
  return r.ok;
}
function expire() {
  user = null;
  reports = [];
  sel = null;
  stack = [];
  show("login");
  openAcc("login");
  $("#loginErr").textContent = "Sesi berakhir. Silakan login lagi.";
}
const EYE =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>';
$$(".pw").forEach((w) => {
  const i = w.querySelector("input"),
    b = document.createElement("button");
  b.type = "button";
  b.className = "eye";
  b.setAttribute("aria-label", "Tampilkan password");
  b.innerHTML = EYE + "</svg>";
  b.onclick = () => {
    const h = i.type === "password";
    i.type = h ? "text" : "password";
    b.innerHTML = EYE + (h ? '<path d="M3 3l18 18"/>' : "") + "</svg>";
    b.setAttribute("aria-label", h ? "Sembunyikan password" : "Tampilkan password");
  };
  w.appendChild(b);
});

function show(v) {
  cv = v;
  ["login", "home", "report", "done", "reports"].forEach((x) =>
    $("#v-" + x).classList.toggle("hide", x !== v),
  );
  $("#menu").classList.toggle("hide", !user);
  document.body.classList.toggle("lg", v === "login");
  $$("#menu [data-v]").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  if (v === "home") renderHome();
  if (v === "reports") renderReports();
  window.scrollTo(0, 0);
}
function go(v) {
  if (v === "home") stack = [];
  else if (cv !== "done" && cv !== v) stack.push(cv);
  show(v);
}
async function nav(v) {
  if (user && (v === "home" || v === "reports")) await loadReports();
  if (user) go(v);
}
function modal(html, btns, wide) {
  $("#mb").innerHTML = html;
  $("#mf").innerHTML = "";
  $("#box").classList.toggle("wide", !!wide);
  btns.forEach((b) => {
    const e = document.createElement("button");
    e.className = "btn " + (b.g ? "ghost" : "");
    e.textContent = b.t;
    e.onclick = b.fn;
    $("#mf").appendChild(e);
  });
  $("#mdl").classList.remove("hide");
}
const closeM = () => $("#mdl").classList.add("hide");
$("#mback").onclick = () => L(closeM, 300);

const EV = [
  [17, "Pengenalan SpeakSafe untuk mahasiswa baru", "09.00"],
  [19, "Workshop mengenali dan mencegah bullying", "13.00"],
  [24, "Sesi tanya jawab bersama PPKPT", "10.00"],
];
const B = { y: new Date().getFullYear(), m: new Date().getMonth() };
let cy = B.y,
  cm = B.m;
function calHTML() {
  const ev = cy === B.y && cm === B.m ? EV : [],
    set = new Set(ev.map((e) => e[0]));
  const first = (new Date(cy, cm, 1).getDay() + 6) % 7,
    days = new Date(cy, cm + 1, 0).getDate();
  let g = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => `<b>${d}</b>`).join("");
  for (let i = 0; i < first; i++) g += '<span class="e"></span>';
  for (let d = 1; d <= days; d++)
    g += set.has(d) ? `<span class="ev" data-d="${d}" tabindex="0">${d}</span>` : `<span>${d}</span>`;
  const mon = new Date(cy, cm, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const side = ev.length
    ? ev
        .map(
          (e) =>
            `<div class="sli" data-d="${e[0]}"><b>${e[0]}</b><span>${e[1]}<small>${e[2]} WIB</small></span></div>`,
        )
        .join("")
    : '<div style="color:var(--mut);font-size:14px">Belum ada jadwal bulan ini.</div>';
  return `<div><div class="calh"><button data-cal="-1" aria-label="Bulan sebelumnya">‹</button><span>${mon}</span><button data-cal="1" aria-label="Bulan berikutnya">›</button></div><div class="cal">${g}</div></div><div><div class="leg"><i></i>Tanggal hijau = ada jadwal</div><h3 style="font-size:19px">Jadwal tersedia</h3>${side}</div>`;
}
const sopHTML =
  '<h2>Panduan <em>SOP PPKPT</em></h2><div class="pdf"><div class="pi">PDF</div><div><b>SOP PPKPT ITSB</b><small>Dokumen resmi</small></div><div class="pb"><button class="btn sm" data-pdf="open">Buka</button><button class="btn sm ghost" data-pdf="dl">Download</button></div></div><div id="pdfNote" class="opt" style="font-size:13px;margin-top:8px"></div><div class="sum"><div><i>1</i><span><b>Lapor</b> · anonim atau dengan identitas</span></div><div><i>2</i><span><b>Diterima</b> · PPKPT meninjau laporan</span></div><div><i>3</i><span><b>Tindak lanjut</b> · sesuai prosedur kampus</span></div><div><i>4</i><span><b>Selesai</b> · status diperbarui</span></div></div>';

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) {
    e.preventDefault();
    L(() => nav(g.dataset.go), 500);
    return;
  }
  const m = e.target.closest("#menu [data-v]");
  if (m) {
    L(() => nav(m.dataset.v), 500);
    return;
  }
  const o = e.target.closest("[data-open]");
  if (o) {
    L(async () => {
      sel = o.dataset.open;
      await nav("reports");
    }, 500);
    return;
  }
  if (e.target.closest("[data-back]")) {
    L(async () => {
      const p = stack.pop() || "home";
      if (user && (p === "home" || p === "reports")) await loadReports();
      if (user) show(p);
    }, 400);
    return;
  }
  const c = e.target.closest("[data-cal]");
  if (c) {
    L(() => {
      cm += +c.dataset.cal;
      if (cm < 0) {
        cm = 11;
        cy--;
      }
      if (cm > 11) {
        cm = 0;
        cy++;
      }
      $("#calBox").innerHTML = calHTML();
    }, 300);
    return;
  }
  const d = e.target.closest(".cal .ev");
  if (d) {
    $$(".sli").forEach((x) => x.classList.toggle("on", x.dataset.d === d.dataset.d));
    return;
  }
  const p = e.target.closest("[data-pdf]");
  if (p) {
    (async () => {
      let ok = false;
      try {
        ok = (await fetch(SOP_PDF, { method: "HEAD" })).ok;
      } catch (_) {}
      if (!ok) {
        $("#pdfNote").textContent =
          "File PDF resmi belum diunggah. Taruh file di folder static dengan nama sop-ppkpt.pdf.";
        return;
      }
      if (p.dataset.pdf === "open") window.open(SOP_PDF, "_blank");
      else {
        const a = document.createElement("a");
        a.href = SOP_PDF;
        a.download = "SOP-PPKPT-ITSB.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    })();
    return;
  }
  const a = e.target.closest("[data-act]");
  if (a) {
    const k = a.dataset.act;
    L(() => {
      if (k === "jadwal") {
        cy = B.y;
        cm = B.m;
        modal(
          '<h2>Jadwal <em>sosialisasi</em></h2><p style="color:var(--mut);margin:4px 0 0;font-size:14px">Contoh data, ganti dengan jadwal resmi PPKPT.</p><div class="cg" id="calBox">' +
            calHTML() +
            "</div>",
          [],
          true,
        );
      }
      if (k === "sop") modal(sopHTML, []);
    }, 500);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset && (e.target.dataset.act || e.target.dataset.go))
    e.target.click();
  if (e.key === "Enter" && e.target.id === "pw") $("#loginBtn").click();
  if (e.key === "Enter" && e.target.id === "rc") $("#regBtn").click();
});
$("#devBtn").onclick = () => $("#dp").classList.toggle("hide");

function openAcc(which) {
  $("#aLogin").classList.toggle("on", which === "login");
  $("#aReg").classList.toggle("on", which === "reg");
  $("#loginErr").textContent = $("#regErr").textContent = $("#loginOk").textContent = "";
}
$("#aLogin .h").onclick = () => L(() => openAcc($("#aLogin").classList.contains("on") ? "" : "login"), 350);
$("#aReg .h").onclick = () => L(() => openAcc($("#aReg").classList.contains("on") ? "" : "reg"), 350);
let tmr;
$("#re").oninput = () => {
  clearTimeout(tmr);
  const e = $("#re").value.trim().toLowerCase();
  if (!ITSB.test(e)) {
    $("#regErr").textContent = "";
    return;
  }
  tmr = setTimeout(async () => {
    const r = await api("/api/check-email?email=" + encodeURIComponent(e));
    if ($("#re").value.trim().toLowerCase() === e)
      $("#regErr").textContent = r.ok && r.data.exists ? "Email ini sudah terdaftar." : "";
  }, 350);
};
$("#regBtn").onclick = () => {
  const n = $("#rn").value.trim(),
    e = $("#re").value.trim().toLowerCase(),
    p = $("#rp").value,
    c = $("#rc").value,
    er = $("#regErr");
  if (!n || !e || !p || !c) {
    er.textContent = "Semua kolom wajib diisi.";
    return;
  }
  if (!ITSB.test(e)) {
    er.textContent = "Gunakan email kampus ITSB (@itsb.ac.id).";
    return;
  }
  if (p.length < 8) {
    er.textContent = "Password minimal 8 karakter.";
    return;
  }
  if (p !== c) {
    er.textContent = "Konfirmasi password tidak sama.";
    return;
  }
  er.textContent = "";
  L(async () => {
    const r = await api("/api/register", "POST", { name: n, email: e, password: p });
    if (!r.ok) {
      er.textContent = r.data.error || "Registrasi gagal.";
      return;
    }
    ["rn", "re", "rp", "rc"].forEach((i) => ($("#" + i).value = ""));
    openAcc("login");
    $("#em").value = e;
    $("#pw").value = "";
    $("#loginOk").textContent = "Registrasi berhasil. Silakan login.";
  }, 1000);
};
$("#loginBtn").onclick = () => {
  const e = $("#em").value.trim().toLowerCase(),
    p = $("#pw").value,
    er = $("#loginErr");
  $("#loginOk").textContent = "";
  if (!e || !p) {
    er.textContent = "Email dan password wajib diisi.";
    return;
  }
  er.textContent = "";
  L(async () => {
    const r = await api("/api/login", "POST", { email: e, password: p });
    if (!r.ok) {
      er.textContent = r.data.error || "Login gagal.";
      return;
    }
    user = r.data.user;
    $("#pw").value = "";
    await loadReports();
    go("home");
  }, 900);
};
$("#out").onclick = () =>
  L(async () => {
    await api("/api/logout", "POST");
    user = null;
    reports = [];
    sel = null;
    stack = [];
    openAcc("");
    show("login");
  }, 600);

$("#jenis").onchange = () => {
  const o = $("#jenis").value === "Lainnya";
  $("#lain").classList.toggle("hide", !o);
  if (o) $("#lain").focus();
};
$("#sendBtn").onclick = () => {
  const k = $("#kron").value.trim(),
    l = $("#lok").value.trim(),
    t = $("#tgl").value,
    er = $("#repErr");
  if (!k || !l || !t) {
    er.textContent = "Tanggal, lokasi, dan kronologi wajib diisi.";
    return;
  }
  const lain = $("#lain").value.trim();
  if ($("#jenis").value === "Lainnya" && !lain) {
    er.textContent = "Isi jenis bullying lainnya pada kotak yang tersedia.";
    return;
  }
  er.textContent = "";
  const anon = document.querySelector("input[name=idt]:checked").value === "anon";
  pending = {
    anon,
    jenis: $("#jenis").value === "Lainnya" ? "Lainnya – " + lain : $("#jenis").value,
    tgl: t,
    lok: l,
    kron: k,
    ket: $("#ket").value.trim(),
  };
  L(() => {
    const body = anon
      ? '<h2>Yakin laporkan <em>dengan anonim</em>?</h2><p style="color:var(--mut)">Identitasmu tidak akan ditampilkan. PPKPT hanya melihat laporan ini sebagai <b>Pelapor anonim</b>.</p>'
      : '<h2>Yakin laporkan <em>dengan identitas</em>?</h2><p style="color:var(--mut)">Nama dan email berikut akan muncul di tampilan PPKPT:</p><div class="id"><b>Nama</b>' +
        esc(user.name) +
        '</div><div class="id"><b>Email</b>' +
        esc(user.email) +
        "</div>";
    modal(body, [
      { t: "Batal", g: 1, fn: closeM },
      {
        t: "Ya, kirim laporan",
        fn: () => {
          closeM();
          L(submit, 1000);
        },
      },
    ]);
  }, 500);
};
async function submit() {
  const r = await api("/api/reports", "POST", pending);
  if (!r.ok) {
    if (r.status === 401) return expire();
    $("#repErr").textContent = r.data.error || "Gagal mengirim laporan. Coba lagi.";
    return;
  }
  const rep = r.data.report;
  reports.unshift(rep);
  sel = rep.no;
  pending = null;
  $("#doneNum").textContent = rep.no;
  ["kron", "lok", "tgl", "ket", "lain"].forEach((i) => ($("#" + i).value = ""));
  $("#lain").classList.add("hide");
  $("#jenis").selectedIndex = 0;
  stack = [];
  show("done");
}
const cur = () => reports.find((r) => r.no === sel);
function renderHome() {
  $("#hList").innerHTML = reports.length
    ? reports
        .slice(0, 3)
        .map(
          (r) =>
            `<div class="hrow" data-open="${r.no}"><span><b>${r.no}</b> · ${esc(r.jenis.split(" ")[0])}</span><span class="tag">${STAGES[r.stage - 1]}</span></div>`,
        )
        .join("")
    : '<div style="color:var(--mut);font-size:14px;margin-top:10px">Belum ada laporan.</div>';
}
function renderReports() {
  $("#noRep").classList.toggle("hide", reports.length > 0);
  $("#list").innerHTML = reports
    .map(
      (r) =>
        `<button class="item ${r.no === sel ? "on" : ""}" data-no="${r.no}"><span><b>${r.no}</b><small>${esc(r.jenis)} · ${esc(r.tgl)}</small></span><span class="tag">${STAGES[r.stage - 1]}</span></button>`,
    )
    .join("");
  $$("#list .item").forEach(
    (b) =>
      (b.onclick = () =>
        L(() => {
          sel = b.dataset.no;
          renderReports();
        }, 500)),
  );
  const r = cur();
  $("#detail").classList.toggle("hide", !r);
  if (!r) return;
  $("#tNum").textContent = r.no;
  $("#tTag").textContent = r.anon ? "Anonim" : "Dengan identitas";
  $("#tInfo").innerHTML = esc(r.jenis) + " · " + esc(r.lok) + (r.ket ? "<br>Keterangan: " + esc(r.ket) : "");
  $("#tl").innerHTML = STAGES.map(
    (n, i) =>
      `<li class="${i < r.stage ? "done" : i === r.stage ? "cur" : ""}"><span class="dot">${i < r.stage ? "✓" : ""}</span><span>${n}</span></li>`,
  ).join("");
  $("#cms").innerHTML = r.cms.length
    ? r.cms
        .map(
          (c) =>
            `<div class="cm ${c.me ? "me" : ""}"><small>${c.me ? "Kamu" : "PPKPT"}</small>${esc(c.t)}</div>`,
        )
        .join("")
    : '<span style="color:var(--mut);font-size:14px">Belum ada komentar.</span>';
}
$("#cbtn").onclick = () => {
  const r = cur(),
    v = $("#cin").value.trim();
  if (!v) return;
  L(async () => {
    const x = await api("/api/reports/" + encodeURIComponent(r.no) + "/comments", "POST", { text: v });
    if (x.ok) {
      r.cms.push(x.data.comment);
      $("#cin").value = "";
      renderReports();
    } else if (x.status === 401) expire();
  }, 600);
};
L(async () => {
  const r = await api("/api/me");
  if (r.ok) {
    user = r.data.user;
    await loadReports();
    go("home");
  } else show("login");
}, 300);

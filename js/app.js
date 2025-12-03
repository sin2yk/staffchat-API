// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
// すでに書いたやつ（ここだけ書き換え）
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ▼ ここから追加：ログイン状態の監視
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      let profile;

      if (snap.exists()) {
        profile = snap.data();
      } else {
        // 初回ログイン時は users/{uid} を自動作成
        const fallbackName =
          user.displayName ||
          (user.email ? user.email.split("@")[0] : "スタッフ");

        profile = {
          displayName: fallbackName,
          email: user.email || "",
          createdAt: new Date(),
        };

        await setDoc(userRef, profile);
      }

      currentUser = {
        uid: user.uid,
        displayName: profile.displayName || "スタッフ",
      };

      $("#currentUserLabel").text(currentUser.displayName);
      $("#signInBtn").addClass("hidden");
      $("#signOutBtn").removeClass("hidden");
    } catch (err) {
      console.error("ユーザープロファイルの取得に失敗:", err);

      // どうしてもダメな場合のフォールバック
      currentUser = {
        uid: user.uid,
        displayName: user.email || "スタッフ",
      };

      $("#currentUserLabel").text(currentUser.displayName);
      $("#signInBtn").addClass("hidden");
      $("#signOutBtn").removeClass("hidden");
    }
  } else {
    // 未ログイン
    currentUser = null;
    $("#currentUserLabel").text("Not signed in");
    $("#signInBtn").removeClass("hidden");
    $("#signOutBtn").addClass("hidden");
  }
});

// 動作確認用
console.log("Firebase 初期化OK", app);
console.log("Auth:", auth);
console.log("Firestore:", db);
// app.js
// StaffChat 単純版（ローカルのみ）
// customers: 顧客マスタ
// selectedCustomerId: 現在選択中の顧客カルテ
// notesByCustomerId: 顧客IDごとのメモ配列

// Firebase Auth から反映するログイン中ユーザー情報
let currentUser = null;

// Firestore から読み込んで中身を埋める前提の空配列にする
let customers = [];

async function updateCustomerLastUpdated(customerId, date) {
  const customer = customers.find((c) => c.id === customerId);
  if (customer) {
    customer.lastUpdatedAt = date;
  }

  try {
    const ref = doc(db, "customers", customerId);
    await updateDoc(ref, {
      lastUpdatedAt: date,
    });
  } catch (err) {
    console.error("lastUpdatedAt の更新に失敗:", err);
  }
}

let selectedCustomerId = "custA"; // 今選んでいる顧客

// Firestore から読み込んだメモをキャッシュする
let notesByCustomerId = {};

// Firestore のリアルタイム購読を解除するための関数
let unsubscribeNotes = null;

// Firestore から customers 一覧を読み込む
async function loadCustomersFromFirestore() {
  try {
    const snap = await getDocs(collection(db, "customers"));

    customers = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        displayName: data.displayName ?? "(no name)",
        lastUpdatedAt: data.lastUpdatedAt ? data.lastUpdatedAt.toDate() : null,
      };
    });

    // 選択中のIDが一覧に無ければ、先頭を選ぶ
    if (
      !customers.find((c) => c.id === selectedCustomerId) &&
      customers.length > 0
    ) {
      selectedCustomerId = customers[0].id;
    }

    renderCustomerList();
    renderNoteList(); // 一旦空 or キャッシュを表示

    // ★ ここで選択中顧客の notes を購読開始
    if (selectedCustomerId) {
      subscribeToNotes(selectedCustomerId);
    }
  } catch (err) {
    console.error("Firestore から customers 読み込み失敗", err);
    alert("カスタマーリストの読み込みに失敗しました");
  }
}

// アプリ起動
$(initApp);

function initApp() {
  console.log("StaffChat app init (local demo)");

  setupLayout(); // 画面の骨組みを作る
  setupAuthUiHandlers(); // ★ ここでヘッダーのログイン/ログアウトボタンにイベントをつなぐ
  bindEvents(); // フォーム送信などのイベントをつなぐ

  // 左ペイン：顧客一覧を customers 配列から描画
  renderCustomerList();

  // ★ レイアウトを作ったあとでレビュー表示を初期化
  initStoreReviews();
  //   // デモ用の初期メモ：Aさんにだけ1件入れておく
  //   notesByCustomerId.custA = [
  //     {
  //       text: "Aさんは、気が短いので、待たせるの厳禁。\nおだてると、高いワイン頼んでくれる。",
  //       createdAt: new Date(),
  //       createdByName: currentUser.displayName,
  //     },
  //   ];
  //     // ★ Aさんの最終更新時刻をセット
  //     const lastNote = notesByCustomerId.custA[notesByCustomerId.custA.length - 1];
  //     updateCustomerLastUpdated("custA", lastNote.createdAt);
  //     // 右ペイン：選択中顧客（初期値は custA）のメモを描画
  //   renderNoteList();

  // ★ 代わりに Firestore から顧客一覧を読み込む
  loadCustomersFromFirestore();
}

/**
 * 画面レイアウトを #app の中に描く
 */
function setupLayout() {
  const $app = $("#app");

  const html = `
    <div class="min-h-screen bg-slate-50 py-6">
      <h1 class="flex items-center justify-center text-lg sm:text-2xl font-bold mb-4 text-slate-800">
        飲食店スタッフ用カスタマー情報チャット
      </h1>

   <div class="grid
            grid-cols-1
            md:grid-cols-[260px,minmax(0,1.5fr)]
            lg:grid-cols-[260px,minmax(0,1.5fr),260px]
            gap-4">


        <!-- 左：カスタマー一覧（今は仮の1件だけ） -->
        <section class="bg-white border rounded-lg shadow-s p-3 flex flex-col md:max-h-[80vh]">
          <div class="flex items-center justify-between mb-2">
        <h2 class="text-s font-semibold text-slate-700">カスタマーリスト</h2>
        <button
            id="addCustomerBtn"
            class="px-2 py-1 text-[12px] border rounded hover:bg-slate-100">
            ＋カスタマー追加
        </button>
        </div>
        <ul id="customerList" class="space-y-1 md:overflow-y-auto md:flex-1 md:pr-1"></ul>
        </section>

        <!-- 中央：メモ一覧＋入力フォーム -->
        <section class="bg-white border rounded-lg shadow-s p-3 flex flex-col md:max-h-[80vh]">
          <div class="mb-3">
            <p class="text-sm text-slate-500">選択中のカスタマー</p>
            <p id="currentCustomerName" class="text-s font-semibold text-slate-800"></p>
          </div>

          <!-- メモ一覧 -->
          <ul
            id="noteList"
            class="flex-1 md:overflow-y-auto space-y-2 mb-3 border-t pt-3 text-sm md:pr-1"
          ></ul>

          <!-- 入力フォーム -->
          <form id="noteForm" class="mt-auto space-y-2">
            <textarea
              id="noteText"
              rows="3"
              class="w-full border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="このお客様についてメモを残す…"
            ></textarea>
            <div class="flex justify-end">
              <button
                type="submit"
                class="px-3 py-1 text-sm rounded-md
                       bg-sky-600 text-white
                       hover:bg-sky-700 active:bg-sky-800"
              >
                メモを追加
              </button>
            </div>
          </form>
        </section>

        <!-- 右：店舗レビュー（Google Maps Places API） -->
          <section
            id="store-reviews"
            class="bg-white border rounded-lg shadow-s p-3 text-sm
            md:max-h-[80vh] flex flex-col"
>
            <h2 class="text-s font-semibold text-slate-700">店舗レビュー</h2>
            <h2 class="text-sm text-slate-700">(Google Maps Places API)</h2>

            <div id="gm-summary" class="text-sm bg-white text-slate-800 border border-slate-200 rounded-lg p-2"></div>
            <ul id="gm-reviews" class="mt-2 text-[13px] bg-white text-slate-800 border border-slate-200 rounded-lg p-2
           md:flex-1 md:max-h-[60vh] md:overflow-y-auto"></ul>
          </section>


      </div>
    </div>
  `;

  // 一発入れ替えでOK
  $app.html(html);
}

// 選択中の顧客のメモを Firestore からリアルタイム購読
function subscribeToNotes(customerId) {
  // 前の購読があれば解除
  if (unsubscribeNotes) {
    unsubscribeNotes();
    unsubscribeNotes = null;
  }

  if (!customerId) {
    notesByCustomerId = {};
    renderNoteList();
    return;
  }

  const notesRef = collection(db, "customers", customerId, "notes");
  const q = query(notesRef, orderBy("createdAt", "desc"));

  unsubscribeNotes = onSnapshot(
    q,
    (snap) => {
      const notes = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text ?? "",
          createdAt: data.createdAt ? data.createdAt.toDate() : null,
          // 投稿者名（無ければ空文字）
          userName: data.createdByDisplayName ?? "",
        };
      });

      notesByCustomerId[customerId] = notes;
      renderNoteList();
    },
    (err) => {
      console.error("notes の購読に失敗:", err);
    }
  );
}

// 左ペイン：顧客一覧を customers 配列から描画
function renderCustomerList() {
  const $list = $("#customerList");
  $list.empty();

  if (!customers || customers.length === 0) {
    $list.append(
      `<li class="text-sm text-slate-400 px-2 py-1">カスタマーがまだ登録されていません</li>`
    );
    return;
  }

  const sorted = [...customers].sort((a, b) => {
    const ta = a.lastUpdatedAt ? a.lastUpdatedAt.getTime() : 0;
    const tb = b.lastUpdatedAt ? b.lastUpdatedAt.getTime() : 0;
    return tb - ta;
  });

  sorted.forEach((c) => {
    const isActive = c.id === selectedCustomerId;

    const updatedLabel = c.lastUpdatedAt
      ? formatTimestamp(c.lastUpdatedAt)
      : "最終更新なし";

    const html = `
      <li>
        <button
          class="
            w-full text-left px-3 py-2 rounded-lg border
            ${
              isActive
                ? "bg-sky-600 text-white border-sky-600 shadow-md"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            }
            flex flex-col gap-0.5
          "
          data-customer-id="${c.id}"
        >
          <span class="text-[13px] font-semibold truncate">
            ${escapeHtml(c.displayName)}
          </span>
          <span class="text-[12px] ${
            isActive ? "text-slate-200" : "text-slate-500"
          }">
            最終更新: ${escapeHtml(updatedLabel)}
          </span>
        </button>
      </li>
    `;
    $list.append(html);
  });
}

// ▼ここに追加：ログイン/ログアウトボタン用のハンドラ
function setupAuthUiHandlers() {
  // ログインボタン
  $("#signInBtn").on("click", async () => {
    const email = window.prompt("メールアドレス：");
    const password = window.prompt("パスワード：");
    if (!email || !password) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged が勝手にUI更新してくれる
      alert("ログイン成功");
    } catch (err) {
      console.error("ログイン失敗", err);
      alert("ログイン失敗：" + err.message);
    }
  });

  // ログアウトボタン
  $("#signOutBtn").on("click", async () => {
    try {
      await signOut(auth);
      alert("ログアウトしました");
    } catch (err) {
      console.error("ログアウト失敗", err);
      alert("ログアウト失敗：" + err.message);
    }
  });
}

// イベントをつなぐ（今はフォーム送信だけ）/

function bindEvents() {
  const $form = $("#noteForm");
  const $textarea = $("#noteText");
  const $customerList = $("#customerList");
  const $addCustomerBtn = $("#addCustomerBtn"); // ← 追加

  // 顧客クリック
  $customerList.on("click", "button[data-customer-id]", function () {
    const id = $(this).data("customer-id");
    selectedCustomerId = id;
    renderCustomerList(); // 左のハイライト更新
    subscribeToNotes(selectedCustomerId); // ← Firestore の購読開始（中で renderNoteList も呼ぶ）
  });

  // 顧客追加
  $addCustomerBtn.on("click", async () => {
    const name = window.prompt("新しいカスタマーの表示名を入力してください：");
    if (!name) return;

    try {
      const createdAt = new Date();

      // Firestore に顧客ドキュメントを追加
      const ref = await addDoc(collection(db, "customers"), {
        displayName: name,
        lastUpdatedAt: null, // まだメモがないので null
      });

      // 追加した顧客を選択状態にして読み込み直し
      selectedCustomerId = ref.id;
      await loadCustomersFromFirestore();
    } catch (err) {
      console.error("カスタマーの追加に失敗:", err);
      alert("カスタマーの追加に失敗しました: " + err.message);
    }
  });

  // メモ送信（Firestore 版）
  $form.on("submit", async function (e) {
    e.preventDefault(); // ブラウザの通常送信（リロード）を止める

    if (!selectedCustomerId) {
      alert("先にカスタマーを選択してください");
      return;
    }
    if (!currentUser) {
      alert("メモを投稿するにはログインが必要です");
      return;
    }

    const text = $.trim($textarea.val());
    if (!text) return; // 白紙提出は無視

    const createdAt = new Date();

    try {
      // Firestore にメモを追加
      const notesRef = collection(db, "customers", selectedCustomerId, "notes");
      await addDoc(notesRef, {
        text,
        createdAt,
        createdByUserId: currentUser.uid ?? null,
        createdByDisplayName: currentUser.displayName ?? "スタッフ",
      });

      // 左ペインの「最終更新」表示用にだけローカルも更新
      updateCustomerLastUpdated(selectedCustomerId, createdAt);
      renderCustomerList();

      // 入力欄クリア
      $textarea.val("");

      // notes の描画は onSnapshot(subscribeToNotes) が勝手にやるのでここでは何もしない
    } catch (err) {
      console.error("メモの保存に失敗しました:", err);
      alert("メモの保存に失敗しました: " + err.message);
    }
  });
}

/**
 * XSS 対策：ユーザーの入力を「ただの文字」にする
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (s) {
    switch (s) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return s;
    }
  });
}

/**
 * タイムスタンプを人間向けに整形（超ざっくり）
 */
function formatTimestamp(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/* メモ1件分を UI に追加する */

function renderNoteList() {
  const $list = $("#noteList");
  $list.empty(); // いったん全消し

  const notes = notesByCustomerId[selectedCustomerId] || [];

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (selectedCustomer) {
    // text() は HTML として解釈しないので、そのまま渡してOK
    $("#currentCustomerName").text(selectedCustomer.displayName);
  } else {
    $("#currentCustomerName").text("");
  }

  notes.forEach((note) => {
    const html = makeNoteHtml(note);
    $list.append(html);
  });
}

function makeNoteHtml(note) {
  const safeText = escapeHtml(note.text || "");
  const safeUser = escapeHtml(note.userName || "スタッフ");
  const timeLabel = note.createdAt ? formatTimestamp(note.createdAt) : "";

  return `
    <li class="border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm">
      <p class="text-s whitespace-pre-line mb-1">${safeText}</p>
      <div class="flex items-center justify-between text-[12px] text-slate-500">
        <span>投稿者：${safeUser}</span>
        <span>${timeLabel}</span>
      </div>
    </li>
  `;
}

// =========================
// 店舗レビュー (Google Maps Places API)
// =========================

const STORE_PLACE_ID = "ChIJoVC4i-iLGGAR9mJULMWzaxM"; // 銀座資生堂パーラーの Place ID

function initStoreReviews() {
  const $summary = $("#gm-summary");
  const $reviews = $("#gm-reviews");
  if (!$summary.length || !$reviews.length) return;

  const dummyDiv = document.createElement("div");
  const service = new google.maps.places.PlacesService(dummyDiv);

  service.getDetails(
    {
      placeId: STORE_PLACE_ID,
      fields: ["name", "rating", "user_ratings_total", "url", "reviews"],
      language: "ja",
    },
    (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK) {
        $summary.html("<p>レビュー情報を取得できませんでした。</p>");
        return;
      }
      renderStoreReviewsJq(place, $summary, $reviews);
    }
  );
}

function renderStoreReviewsJq(place, $summary, $reviews) {
  $summary.html(`
    <p><strong>${place.name}</strong></p>
    <p>Google評価：★${place.rating}（${place.user_ratings_total}件）</p>
    <p class="px-3 py-1 text-xs rounded-md
                       bg-sky-600 text-white
                       hover:bg-sky-700">
                       <a href="${place.url}" target="_blank" rel="noopener">
                       Googleマップで見る</a></p>
  `);

  const reviews = (place.reviews || []);
  if (!reviews.length) {
    $reviews.html("<li>クチコミはまだありません。</li>");
    return;
  }

  const items = reviews.map((r) => {
    const text = r.text.length > 80 ? r.text.slice(0, 80) + "…" : r.text;
    return `
      <li>
        <p>「${text}」</p>
        <p>★${r.rating} — ${r.author_name}</p>
      </li>
    `;
  });
  $reviews.html(items.join(""));
}

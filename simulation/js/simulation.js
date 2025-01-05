// --------------------------------------------------------------------- //
// Firebase連携
// --------------------------------------------------------------------- //

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { getFirestore, collection, getDocs, getDoc, doc, addDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js"; // Firestoreを使うためのモジュールを追加
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { firebaseConfig } from '../../config/firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);



// --------------------------------------------------------------------- //
// 表示しているSceneに合わせて関数を実行する
// --------------------------------------------------------------------- //

$(document).ready(function() {
  const scene = $('body').data('scene');
  if (scene === 0 || scene === 2 || scene === 4) {
    displayStories();
  } else if (scene === 1 || scene === 3 || scene === 5) {
    displayLatestAnswer();
  } else if ($('body').data('scene') === "ending"){
    displayResult();
  } else if($('body').data('scene') === "summary"){
    displaySummary();
  }
});


// --------------------------------------------------------------------- //
// dbからデータを取得
// --------------------------------------------------------------------- //

const db = getFirestore(app); // Firestoreのインスタンスを取得
const usersRef = collection(db, "users"); // "stories"コレクションへの参照を取得
const storiesRef = collection(db, "stories"); // "stories"コレクションへの参照を取得
const playHistoryRef = collection(db, "playHistory"); // "playHitoriy"コレクションへの参照を取得
const endingRef = collection(db, "ending"); // "ending"コレクションへの参照を取得


// --------------------------------------------------------------------- //
// シミュレーション中断アラート
// --------------------------------------------------------------------- //

$("#cancel").click(function(e){
    e.preventDefault(); // デフォルトのリンク動作を防止
    
    const result = confirm("ほんとうにゲームをちゅうしする？でーたがきえちゃうよ！");
    
    if (result) {
        // はいを選択した場合
        window.location.href = '../map.html'; // map.htmlに遷移
    }
    // いいえを選択した場合は何もせず、現在のページに留まる
});


// --------------------------------------------------------------------- //
// シチュエーションを選んだ際にローカルストレージにsituation-idを保存する
// --------------------------------------------------------------------- //

$(document).ready(function() {
  $("#stage-1").click(async function() {
    let situationId = $(this).data("situation-id");
    console.log(situationId); // situationId の値を確認
    localStorage.setItem('currentSituationId', situationId);
    
    if (situationId) {
      console.log(situationId);
      window.location.href = "outline.html";
    } else {
      console.log("失敗してます！");
    }
  });
});


// --------------------------------------------------------------------- //
// storiesコレクションのドキュメントを取得し、HTMLで表示(scene-0,2,4)
// --------------------------------------------------------------------- //

async function displayStories() {
  // 現在のシーン番号を取得
  const scene = $('body').data('scene');
  
  if (scene === 0) {
    // Scene-0の場合は situationId-0-0 を表示
    const situationId = localStorage.getItem('currentSituationId');
    const currentStoryId = situationId + "-0-0";
    // currentStoryIdをローカルストレージに保存
    localStorage.setItem('currentStoryId', currentStoryId);
    await displayStoryContent(currentStoryId);
  } 
  else if (scene === 2 || scene === 4) {
    try {
      // playHistoryコレクションから最新のドキュメントを取得
      const q = query(
        playHistoryRef,
        orderBy("timestamp", "desc"),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // 最新のドキュメントからnextStoryIdを取得
        const latestDoc = querySnapshot.docs[0];
        const nextStoryId = latestDoc.data().nextStoryId;
        
        // nextStoryIdをcurrentStoryIdとしてローカルストレージに保存
        localStorage.setItem('currentStoryId', nextStoryId);
        
        // nextStoryIdを使ってストーリーコンテンツを表示
        await displayStoryContent(nextStoryId);
      } else {
        console.log("No history found");
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }
}

// ストーリーコンテンツを表示する共通関数
async function displayStoryContent(docId) {
  const docRef = doc(storiesRef, docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const stories = docSnap.data();
    const text = stories.text;
    const choices = stories.choices;
    const images = stories.images;

    $("#text").text(text);

    // 選択肢のテキストを表示
    choices.forEach((choice, index) => {
      $(`#${index}`).append(choice.choiceText);
    });

    $("#img-left").attr('src', images[0]);
    $("#img-right").attr('src', images[1]);
  } else {
    console.log("No stories found for docId: " + docId);
  }
}


// --------------------------------------------------------------------- //
// choiceをクリックしたときに、選択肢を保存して次のページに移動(scene-0)
// --------------------------------------------------------------------- //

$(".choice").click(async function() {
    try {
        // 必要なデータを取得
        const choiceId = $(this).attr("id");
        const sequence = $("body").data("sequence");
        const situationId = localStorage.getItem('currentSituationId'); // これは初期選択時に必要なため残す
        const currentStoryId = $(this).closest('body').data('currentStoryId') || localStorage.getItem('currentStoryId');

        // 現在のストーリーデータを取得
        const docRef = doc(storiesRef, currentStoryId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const storyData = docSnap.data();
            const selectedChoice = storyData.choices[choiceId];
            
            // Firestoreに回答内容を保存
            await addDoc(playHistoryRef, {
                selectedChoice: selectedChoice.choiceText,
                situationId: situationId,
                sequence: sequence,
                currentStoryId: currentStoryId,
                nextStoryId: selectedChoice.nextStoryId,
                timestamp: serverTimestamp()
            });

            // 次のシーンに遷移
            let currentScene = $("body").data("scene");
            let nextSceneNum = currentScene + 1;
            window.location.href = `scene-${nextSceneNum}.html`;
            
        } else {
            console.error("Story document not found:", currentStoryId);
        }
        
    } catch (error) {
        console.error("Error processing choice:", error);
    }
});

// --------------------------------------------------------------------- //
// 回答に合わせて、テキスト・画像・ユーザー名を表示する(scene-1)
// --------------------------------------------------------------------- //

async function displayLatestAnswer() {
  try {
    // ①playHistoryコレクションから最新のドキュメントを取得
    const q = query(
      playHistoryRef,
      orderBy("timestamp", "desc"),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // 最新のドキュメントからデータを取得
      const latestDoc = querySnapshot.docs[0];
      const latestData = latestDoc.data();
      
      // ②選択されたテキストを表示
      const selectedChoice = latestData.selectedChoice;
      $('#answer').text(selectedChoice);
      
      // ③現在のストーリーIDを使って画像を取得・表示
      const currentStoryId = latestData.currentStoryId;
      const storyRef = doc(storiesRef, currentStoryId);
      const storySnap = await getDoc(storyRef);
      
      if (storySnap.exists()) {
        const storyData = storySnap.data();
        const images = storyData.images;
        
        $("#img-left").attr('src', images[0]);
        $("#img-right").attr('src', images[1]);
      } else {
        console.log("No story found for ID:", currentStoryId);
      }
      
    } else {
      $('#answer').text('まだデータが保存されていません。');
      console.log("No history found");
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    $('#answer').text('データの取得に失敗しました。');
  }

  // 次のシーンへの遷移処理
  $('#next').on('click', function () {
    let currentScene = $("body").data("scene");
    
    if (currentScene === 5) {
        // scene-5の場合はresult.htmlに遷移
        window.location.href = "result.html";
    } else {
        // それ以外の場合は次のシーンに遷移
        let nextSceneNum = currentScene + 1;
        const nextScene = `scene-${nextSceneNum}.html`;
        window.location.href = nextScene;
    }
  });
}

// --------------------------------------------------------------------- //
// 選択の結果に合わせてエンディングが表示される(result)
// --------------------------------------------------------------------- //

async function displayResult() {
  try {
    // ①playHistoryから最新のドキュメントを取得してendingを決定
    const q = query(
      playHistoryRef,
      orderBy("timestamp", "desc"),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const latestDoc = querySnapshot.docs[0];
      const ending = latestDoc.data().nextStoryId; // fail or clear
      const situationId = latestDoc.data().situationId;

      // ②endingコレクションから該当するドキュメントを取得
      const endingRef = doc(db, "ending", situationId);
      const endingSnap = await getDoc(endingRef);

      if (endingSnap.exists()) {
        const endingData = endingSnap.data();

        // ③エンディングデータを取得
        const character = endingData.character[ending];
        const text = endingData.text[ending];
        const evaluation = endingData.evaluation[ending];

        // usersコレクションからユーザーの性別を取得
        const userDoc = await getDoc(doc(db, "users", "Kfa6xHusnnjKkPFJZAdo")); // ユーザーIDを指定
        const gender = userDoc.data().gender;

        // 性別でキャラクターのイメージを出し分ける
        const characterImg = endingData.characterImg[gender][ending];

        // 取得したデータを表示
        $("#character").text(character);
        $("#text").text(text);
        $("#characterImg").attr('src', characterImg);
        $("#evaluation").text(evaluation);

      } else {
        console.error("No ending document found for situationId:", situationId);
      }
    } else {
      console.error("No play history found");
    }
  } catch (error) {
    console.error("Error displaying result:", error);
  }

  // 次のページへの遷移
  $('#next').on('click', function () {
    window.location.href = 'summary.html';
  });
}

// --------------------------------------------------------------------- //
// situationに合わせてまとめが表示される(takeaway)
// --------------------------------------------------------------------- //

async function displaySummary() {

  // ①situationIdをローカルから取得する
  const situationId = localStorage.getItem('currentSituationId');

  // ②endingコレクションのデータを取得する
  const querySnapshot = await getDocs(endingRef);

  // ③situationIdと一致したendingドキュメントを取得する
  const endingDoc = querySnapshot.docs.find(doc => doc.id === situationId);

  if (endingDoc) {
    const endingData = endingDoc.data();
    const advice = endingData.advice;
    $("#advice").text(advice); // 取得したデータを表示
  } else {
    console.log("No ending found for situationId: " + situationId);
  }

  $('#next').on('click', function () {
    window.location.href = 'summary.html';
  });
}
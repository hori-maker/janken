document.addEventListener('DOMContentLoaded', () => {
    // ----- DOM要素の取得 -----
    const currentRoundSpan = document.getElementById('currentRound');
    const playerHandSelectionDiv = document.getElementById('playerHandSelection');
    const roundResultDiv = document.getElementById('roundResult');
    
    const playerChoiceSpan = document.getElementById('playerChoice');
    const playerChoiceIconSpan = document.getElementById('playerChoiceIcon'); // IDを修正 (createElementではなくHTMLにある前提)

    const computerChoiceSpan = document.getElementById('computerChoice');
    const computerChoiceIconSpan = document.getElementById('computerChoiceIcon'); // IDを修正

    const currentWinsSpan = document.getElementById('currentWins');
    const currentTotalRoundsSpan = document.getElementById('currentTotalRounds');
    
    const finalResultsDiv = document.getElementById('finalResults');
    const totalRoundsFinalSpan = document.getElementById('totalRoundsFinal');
    const finalWinsSpan = document.getElementById('finalWins');
    const finalLossesSpan = document.getElementById('finalLosses');
    const finalDrawsSpan = document.getElementById('finalDraws');
    const expectedWinsSpan = document.getElementById('expectedWinsFinal');
    const stdDevSpan = document.getElementById('stdDevFinal');
    const zScoreSpan = document.getElementById('zScoreFinal');
    const messageAreaFinal = document.getElementById('messageAreaFinal');
    const downloadChartButton = document.getElementById('downloadChartButton');
    const resetGameButton = document.getElementById('resetGameButton');
    const ctx = document.getElementById('myChart').getContext('2d');

    // ----- ゲーム設定 -----
    const MAX_ROUNDS = 90; // 総試行回数
    const WIN_PROBABILITY = 1/3; // 勝ちの確率 (あいこも考慮しない場合)

    // ----- ゲーム状態変数 -----
    let currentRound = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let playerHand = -1; // 0:グー, 1:チョキ, 2:パー
    let computerHand = -1;
    let myChart = null; // Chartインスタンス

    // ----- Helper Functions -----
    const handMap = { 0: 'グー', 1: 'チョキ', 2: 'パー' };
    const handEmojiMap = { 0: '✊', 1: '✌️', 2: '✋' };

    // ランダムなコンピュータの手を生成
    function getRandomComputerHand() {
        return Math.floor(Math.random() * 3);
    }

    // 勝敗判定 (playerHand: 0,1,2, computerHand: 0,1,2)
    // 0:あいこ, 1:勝ち, 2:負け
    function judge(player, computer) {
        if (player === computer) return 0; // あいこ
        if (
            (player === 0 && computer === 1) || // グー vs チョキ
            (player === 1 && computer === 2) || // チョキ vs パー
            (player === 2 && computer === 0)    // パー vs グー
        ) {
            return 1; // 勝ち
        }
        return 2; // 負け
    }

    // 結果メッセージの更新
    function updateResultsDisplay() {
        currentRoundSpan.textContent = currentRound;
        playerChoiceSpan.textContent = playerHand !== -1 ? handMap[playerHand] : '？';
        playerChoiceIconSpan.textContent = playerHand !== -1 ? handEmojiMap[playerHand] : '';
        
        computerChoiceSpan.textContent = computerHand !== -1 ? handMap[computerHand] : '？';
        computerChoiceIconSpan.textContent = computerHand !== -1 ? handEmojiMap[computerHand] : '';
        
        currentWinsSpan.textContent = wins;
        currentTotalRoundsSpan.textContent = currentRound;
    }

    // ★誤差関数 (Error Function) の計算 (近似)★
    // 精度を高めるための実装。より高精度なライブラリもありますが、ここでは標準的・簡易的なものを採用。
    function erf(x) {
        // constants
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;

        // save the sign of x
        let sign = 1;
        if (x < 0)
            sign = -1;
        x = Math.abs(x);

        // a series of maclaurin constant approximations
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    // ★正規分布の累積分布関数 (CDF)★
    function normalCdf(x, mean, stdDev) {
        // Zスコアを計算
        let z = (x - mean) / stdDev;
        // CDF = 0.5 * (1 + erf(z / sqrt(2)))
        return 0.5 * (1 + erf(z / Math.sqrt(2)));
    }

      // 最終結果の表示と統計計算
    function showFinalResults() {
        finalResultsDiv.classList.remove('hidden');
        playerHandSelectionDiv.classList.add('hidden'); 
        roundResultDiv.classList.add('hidden'); 

        // ★★★ 統計量の計算 (一度だけ宣言) ★★★
        const expectedWins = MAX_ROUNDS * WIN_PROBABILITY;
        const variance = MAX_ROUNDS * WIN_PROBABILITY * (1 - WIN_PROBABILITY);
        const stdDev = Math.sqrt(variance);
        const zScore = (wins - expectedWins) / stdDev;

        // ★累積確率と上位/下位パーセンテージを計算★
        const cumulativeProbability = normalCdf(wins, expectedWins, stdDev); // 下位からの確率
        const upperTailProbability = 1 - cumulativeProbability; // 上位からの確率 (パーセンテージ)

        // 結果表示用のspan要素に値を設定
        totalRoundsFinalSpan.textContent = MAX_ROUNDS;
        finalWinsSpan.textContent = wins;
        finalLossesSpan.textContent = losses;
        finalDrawsSpan.textContent = draws;
        expectedWinsSpan.textContent = expectedWins.toFixed(2);
        stdDevSpan.textContent = stdDev.toFixed(2);
        zScoreSpan.textContent = zScore.toFixed(2);

        // ★メッセージ生成・表示部分★
        let message = '';
        let messageClass = '';

        // Z値の絶対値が1.96以上 (5%有意水準) の場合
        if (Math.abs(zScore) >= 1.96) {
            if (zScore > 0) { // 上位の場合
                const luckyMessages = [
                    `【お見事！確率を超えた勝利！】 ${wins}勝、Z値 ${zScore.toFixed(2)}。これは統計的に見て、上位約 ${(upperTailProbability * 100).toFixed(1)}% に入る、大変珍しい結果です！君のじゃんけん、もしかしたらAIより強いかも？`,
                    `【AIも驚愕！規格外の強さ！】 ${wins}勝、Z値 ${zScore.toFixed(2)}。この結果は、統計学的に見ても非常に珍しい、上位約 ${(upperTailProbability * 100).toFixed(1)}% の幸運な結果です！君のじゃんけん、もはやAIの予測を超えている！`,
                    `【統計学も唸る！未来予知？】 ${wins}勝、Z値 ${zScore.toFixed(2)}。この結果は、統計的に見て上位約 ${(upperTailProbability * 100).toFixed(1)}% に入る、まさに奇跡！もしかしたら、未来を予知でもしているのか…？`,
                    `【君こそがじゃんけん王！】 ${wins}勝、Z値 ${zScore.toFixed(2)}！これは、上位約 ${(upperTailProbability * 100).toFixed(1)}% の偉業！ 君は、AIに勝つだけでなく、確率をも操るじゃんけんの支配者だ！ この幸運を、ぜひ他のことにも活かしてくれ！`
                ];
                message = luckyMessages[Math.floor(Math.random() * luckyMessages.length)];
                messageClass = 'lucky';
            } else { // 下位の場合
                const unluckyMessages = [
                    `【珍しい結果かも？】 ${wins}勝、Z値 ${zScore.toFixed(2)}。これは統計的に見て、下位約 ${(cumulativeProbability * 100).toFixed(1)}% に入る、なかなか見られない結果です。今日は宇宙の法則が乱れているのかも…？`,
                    `【確率は君の敵だった？】 ${wins}勝、Z値 ${zScore.toFixed(2)}。確率を計算すると、この結果は下位約 ${(cumulativeProbability * 100).toFixed(1)}% に位置します。まるで、AIが「君には負ける」ということを学習したかのよう…。`,
                    `【伝説は、ここから始まる…？】 ${wins}勝、Z値 ${zScore.toFixed(2)}。これは、偶然とは言えないほど低い確率を記録しました。統計学的に見ると、この結果は下位約 ${(cumulativeProbability * 100).toFixed(1)}% に入ります。ある意味、君は統計の荒らしだ！`,
                    `【今日の運勢、星３つ…？】 ${wins}勝、Z値 ${zScore.toFixed(2)}。この結果は、統計的に見て下位約 ${(cumulativeProbability * 100).toFixed(1)}% です。今日の運勢は、統計データによると…あまり良くないかもしれませんね。`
                ];
                message = unluckyMessages[Math.floor(Math.random() * unluckyMessages.length)];
                messageClass = 'unlucky';
            }
        } else {
            // 通常メッセージ
            message = `堅実な結果！ ${wins}勝はZ値 ${zScore.toFixed(2)}。この結果は、統計的に見て上位約 ${(upperTailProbability * 100).toFixed(1)}% に入ります。`;
        }
        
        messageAreaFinal.textContent = message;
        messageAreaFinal.className = 'message-area'; // クラスをリセット
        if (messageClass) {
            messageAreaFinal.classList.add(messageClass);
        }

        // グラフの描画
        drawChart(wins, expectedWins, stdDev, zScore);
    }

    // 正規分布の確率密度関数 (グラフ描画用)
    function normalPdf(x, mean, stdDev) {
        return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
    }

    // グラフ描画関数 (上記と同じなので省略)
    function drawChart(currentWins, mean, stdDev, zScore) {
        if (myChart) {
            myChart.destroy(); // 既存のグラフがあれば破棄
        }

        const labels = Array.from({ length: MAX_ROUNDS + 1 }, (_, i) => i); 
        const normalDistributionData = labels.map(x => normalPdf(x, mean, stdDev) * MAX_ROUNDS * 2); 
        const barData = labels.map(x => (x === currentWins ? 1 : 0)); 

        myChart = new Chart(ctx, {
            type: 'bar', 
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '正規分布近似曲線',
                        type: 'line',
                        data: normalDistributionData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        fill: false,
                        yAxisID: 'y-pdf',
                        pointRadius: 0, 
                        tension: 0.4 
                    },
                    {
                        label: '今回の勝ち数',
                        type: 'bar',
                        data: barData, 
                        backgroundColor: (context) => {
                            if (context.dataIndex === currentWins) {
                                if (Math.abs(zScore) >= 1.96) { // 有意水準5%
                                    return zScore > 0 ? 'rgba(255, 99, 132, 0.7)' : 'rgba(75, 192, 192, 0.7)'; 
                                }
                                return 'rgba(255, 206, 86, 0.7)'; 
                            }
                            return 'transparent'; 
                        },
                        borderColor: (context) => {
                            if (context.dataIndex === currentWins) {
                                if (Math.abs(zScore) >= 1.96) {
                                    return zScore > 0 ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)';
                                }
                                return 'rgba(255, 206, 86, 1)';
                            }
                            return 'transparent';
                        },
                        borderWidth: 1,
                        yAxisID: 'y-bar'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: '勝ち数' },
                        min: Math.max(0, Math.floor(mean - 3 * stdDev)), 
                        max: Math.min(MAX_ROUNDS, Math.ceil(mean + 3 * stdDev)),
                        ticks: { autoSkip: true, maxTicksLimit: 10 }
                    },
                    'y-pdf': { 
                        type: 'linear', position: 'left', title: { display: true, text: '確率密度' },
                        grid: { drawOnChartArea: false }, display: false 
                    },
                    'y-bar': { 
                        type: 'linear', position: 'right', title: { display: true, text: '頻度 (相対的)' },
                        min: 0, max: 1.2, 
                        ticks: { stepSize: 0.2, callback: function(value, index, values) { return value === 0 || value === 1 ? value : null; } }
                    }
                },
                plugins: {
                    title: { display: true, text: 'じゃんけん90回 勝ち数分布と正規分布近似' },
                    legend: { display: true },
                    annotation: {
                        annotations: {
                            meanLine: { type: 'line', xMin: mean, xMax: mean, borderColor: 'rgba(0, 0, 0, 0.8)', borderWidth: 2, borderDash: [6, 6], label: { content: '期待値 ' + mean.toFixed(1), enabled: true, position: 'start', backgroundColor: 'rgba(0, 0, 0, 0.7)', font: { size: 10 } } },
                            currentWinsLine: { type: 'line', xMin: currentWins, xMax: currentWins, borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 3, borderDash: [2, 2], label: { content: '今回の勝ち数 ' + currentWins, enabled: true, position: 'end', backgroundColor: 'rgba(255, 99, 132, 0.8)', font: { size: 10 } } },
                            minus1Sigma: { type: 'line', xMin: mean - stdDev, xMax: mean - stdDev, borderColor: 'rgba(100, 100, 100, 0.4)', borderWidth: 1, borderDash: [2, 2] },
                            plus1Sigma: { type: 'line', xMin: mean + stdDev, xMax: mean + stdDev, borderColor: 'rgba(100, 100, 100, 0.4)', borderWidth: 1, borderDash: [2, 2] },
                            minus2Sigma: { type: 'line', xMin: mean - 2 * stdDev, xMax: mean - 2 * stdDev, borderColor: 'rgba(100, 100, 100, 0.4)', borderWidth: 1, borderDash: [2, 2] },
                            plus2Sigma: { type: 'line', xMin: mean + 2 * stdDev, xMax: mean + 2 * stdDev, borderColor: 'rgba(100, 100, 100, 0.4)', borderWidth: 1, borderDash: [2, 2] },
                            minus1SigmaArea: { type: 'box', xMin: mean - stdDev, xMax: mean + stdDev, backgroundColor: 'rgba(54, 162, 235, 0.1)', borderColor: 'transparent' },
                            minus2SigmaArea: { type: 'box', xMin: mean - 2 * stdDev, xMax: mean + 2 * stdDev, backgroundColor: 'rgba(54, 162, 235, 0.05)', borderColor: 'transparent' }
                        }
                    }
                }
            }
        });
    }

    // グラフダウンロード機能
    downloadChartButton.addEventListener('click', () => {
        if (myChart) {
            const image = myChart.toBase64Image('image/png');
            const a = document.createElement('a');
            a.href = image;
            a.download = 'じゃんけん統計シミュレーター_結果.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('グラフがまだ描画されていません。');
        }
    });

    // ゲームリセット機能
    resetGameButton.addEventListener('click', () => {
        currentRound = 0;
        wins = 0;
        losses = 0;
        draws = 0;
        playerHand = -1;
        computerHand = -1;
        roundResultDiv.textContent = '';
        roundResultDiv.classList.remove('lucky', 'unlucky');
        
        updateResultsDisplay();
        
        finalResultsDiv.classList.add('hidden');
        playerHandSelectionDiv.classList.remove('hidden');
        roundResultDiv.classList.remove('hidden');

        if (myChart) {
            myChart.destroy();
            myChart = null;
        }
    });

    // ----- イベントリスナーの設定 -----
    playerHandSelectionDiv.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            if (currentRound >= MAX_ROUNDS) return; 

            playerHand = parseInt(button.dataset.hand); 
            computerHand = getRandomComputerHand();
            const result = judge(playerHand, computerHand);

            let roundMessage = '';
            switch (result) {
                case 0: // あいこ
                    roundMessage = 'あいこ！';
                    draws++;
                    break;
                case 1: // 勝ち
                    roundMessage = 'あなたの勝ち！';
                    wins++;
                    break;
                case 2: // 負け
                    roundMessage = 'あなたの負け…';
                    losses++;
                    break;
            }
            currentRound++;
            roundResultDiv.textContent = roundMessage;
            updateResultsDisplay();

            if (currentRound === MAX_ROUNDS) {
                showFinalResults();
            }
        });
    });

    // ----- 初期化 -----
    updateResultsDisplay(); // この関数の前に、HTMLの冒頭の文言を修正します。

// --- HTMLの <p> タグのテキストを修正 ---
// index.html の 15行目あたりにある
// <p>生徒とコンピューターで90回じゃんけんをして、勝ち数の分布を統計的に見てみよう！</p>
// を、以下のように修正してください。
//
// <p>さあ、君はAIに勝てるか！？ 90回のじゃんけんで、勝利の確率を体験しよう！</p>
//
// HTMLファイルを直接編集するのが一番簡単です。
});
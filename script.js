const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let wins = 0, losses = 0, gameCounter = 1;
let activeSlot, discardSlot, successSlot, deckSlot;
let scoreVal, winsVal, lossVal, deckCountVal, gameVal;
let endModal, endTitle, endMessage, endComment, modalDealBtn, boardDealBtn;
let rulesModal, optionsModal, leaderboardModal, themeIcon;
let lossTimer = null; // Tracks the pending "Game Over"
let winTimer = null; // New variable to protect the victory trigger
let deck = [], selectedCard = null, sessionScore = 0, roundEnded = false, isLocked = false;
let highScore = localStorage.getItem('treceHighScore') || 0; // Loads the high score from the user's device
const zAnim = getComputedStyle(document.documentElement).getPropertyValue('--z-animations').trim() || '12000';

function getCryptoRandom(max) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
}

function closeLanding() {
    const landing = document.getElementById('landing-page');
    const scaler = document.getElementById('scaler');

    // 1. DEAL FIRST (While the landing page is still 100% opaque)
    if (typeof initGame === 'function') {
        initGame();
    }

    // 2. LIFT THE CURTAIN SECOND
    // Now that the cards are already in place, we just fade the blur
    landing.style.transform = "translateY(-110%)";
    landing.style.opacity = "0";
    scaler.classList.add('active'); // Removes the blur

    setTimeout(() => {
        landing.style.display = 'none';
    }, 800);
}

function initGame() {
    if (winTimer) {
        clearTimeout(winTimer);
        winTimer = null;
        end(true); // Ensure the win is recorded even if they click 'Deal' during the cinematic pause!
    }
    if (lossTimer) { clearTimeout(lossTimer); lossTimer = null; }
    if (isLocked) return;
    if (roundEnded) { gameCounter++; gameVal.innerText = gameCounter; }
    roundEnded = false; selectedCard = null;
    endModal.style.display = 'none';
    rulesModal.style.display = 'none';

    deck = [];
    const suits = [{ s: '♠', c: 'black' }, { s: '♥', c: '#d32f2f' }, { s: '♦', c: '#d32f2f' }, { s: '♣', c: 'black' }];
    const names = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    // 1. Create the sorted deck
    suits.forEach(suit => names.forEach((name, i) => deck.push({ n: name, v: i + 1, s: suit.s })));

    // 2. THE VEGAS DOUBLE-SHUFFLE
    // We run the Fisher-Yates twice to ensure neighbors are fully separated
    for (let pass = 0; pass < 2; pass++) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = getCryptoRandom(i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    // 3. THE TRIPLE CUT
    // We do 3 small cuts to randomize the "top" of the deck more effectively
    for (let i = 0; i < 3; i++) {
        const cutIdx = getCryptoRandom(20) + 15;
        deck = [...deck.splice(cutIdx), ...deck];
    }

    // 4. Clean the board and Render
    document.querySelectorAll('.column, .slot').forEach(el => el.innerHTML = '');
    updateDeckVisuals();

    for (let i = 0; i < 7; i++) {
        for (let j = 0; j <= i; j++) {
            const cardData = deck.pop();
            if (cardData) {
                renderCard(cardData, 'col-' + i, j, j < i);
            }
        }
    }
    reposition(); updateUI();
}

function updateDeckVisuals() {
    const ds = deckSlot;
    ds.innerHTML = '';

    if (deck.length > 0) {
        ds.classList.remove('deck-empty'); // Show the card back
        const b = document.createElement('div');
        b.className = 'card facedown';
        ds.appendChild(b);
    } else {
        ds.classList.add('deck-empty'); // Show the faded "13" logo
    }
}

function renderCard(data, containerId, index, isFacedown) {
    if (!data) return;
    const div = document.createElement('div');
    div.className = 'card' + (isFacedown ? ' facedown' : '');
    div.dataset.suit = data.s;
    div.dataset.v = data.v;
    div.innerHTML = `<div class="rank">${data.n}</div><div class="card-center-suit">${data.s}</div>`;
    div.onclick = (e) => {
        if (roundEnded || div.classList.contains('facedown') || div.parentElement.id === 'success-slot' || div.nextElementSibling) return;
        if (parseInt(div.dataset.v) === 13) { fly([div]); }
        else if (!selectedCard) { selectedCard = div; div.classList.add('selected'); }
        else {
            if (selectedCard === div) { div.classList.remove('selected'); selectedCard = null; }
            else if (parseInt(selectedCard.dataset.v) + parseInt(div.dataset.v) === 13) {
                const c1 = selectedCard; selectedCard = null; fly([c1, div]);
            } else {
                if (navigator.vibrate) navigator.vibrate(100);
                const c1 = selectedCard, c2 = div;
                c1.classList.add('error'); c2.classList.add('error');
                setTimeout(() => { c1.classList.remove('error', 'selected'); c2.classList.remove('error'); }, 200);
                selectedCard = null;
            }
        }
    };
    const container = document.getElementById(containerId);
    if (container) container.appendChild(div);
}

function fly(cards) {
    const success = successSlot;
    const sRect = success.getBoundingClientRect();
    cards.forEach((el, i) => {
        const eRect = el.getBoundingClientRect();

        // Use the new class to trigger the smooth transition
        el.classList.add('flying', 'in-transit');

        el.style.transform = `translate(${sRect.left - eRect.left}px, ${sRect.top - eRect.top}px) scale(1.1)`;

        setTimeout(() => {
            el.classList.remove('flying', 'selected', 'in-transit');
            el.style.transform = 'none';
            el.style.top = '0px';
            el.style.zIndex = success.children.length + 10;
            success.appendChild(el);
            if (i === cards.length - 1) { reposition(); reveal(); }
        }, 400); // Matches the 0.6s in CSS
    });
    setTimeout(() => {
        reposition();
        reveal(); // This flips the next card while the old ones are still flying
    }, 50);
}

function drawCard() {
    if (deck.length === 0 || roundEnded) return;
    if (selectedCard) {
        selectedCard.classList.remove('selected');
        selectedCard = null;
    }
    const active = activeSlot, discard = discardSlot, ds = deckSlot;
    if (active.children.length > 0 && active.children[0].classList.contains('in-transit')) {
        return;
    }
    if (active.children.length > 0) {
        const old = active.children[0];
        old.style.zIndex = "100";
        // Ensure the slide is smooth
        old.style.transition = "transform 0.15s ease-out";
        // Determine direction: Positive for Left Hand, Negative for Right Hand
        const isRightHanded = document.getElementById('scaler').classList.contains('right-handed-layout');
        const direction = isRightHanded ? -1.2 : 1.2;
        old.style.transform = `translateX(${active.offsetWidth * direction}px)`;
        setTimeout(() => {
            old.style.transition = ""; // Reset
            old.style.transform = "none";
            old.style.zIndex = "";
            discard.appendChild(old);
            reposition();
        }, 150);
    }
    if (ds.children.length > 0) {
        const dsRect = ds.getBoundingClientRect(), acRect = active.getBoundingClientRect();
        const flipping = ds.lastElementChild;
        flipping.style.zIndex = "200";
        flipping.style.transition = "transform 0.2s ease-in";
        flipping.style.transform = `translate(${acRect.left - dsRect.left}px, 0) rotateY(90deg)`;
        setTimeout(() => {
            flipping.remove();
            renderCard(deck.pop(), 'active-slot', 0, false);
            updateUI();
            updateDeckVisuals();
            // Wait an extra 50ms for the DOM to register the new card
            setTimeout(check, 50);
        }, 200);
    }

}

function reveal() {
    let flippedCount = 0;
    const columns = document.querySelectorAll('.column');
    const isRight = document.getElementById('scaler').classList.contains('right-handed-layout');
    const targetAngle = isRight ? -90 : 90;

    columns.forEach(col => {
        const last = col.lastElementChild;
        if (last && last.classList.contains('facedown')) {
            flippedCount++;

            // Phase 1: Spin to 90/-90 degrees
            last.classList.add('flipping');
            last.style.transform = `rotateY(${targetAngle}deg)`;

            setTimeout(() => {
                // Phase 2: Swap face and spin to 0
                // CRITICAL: We remove facedown here so the front is visible as it spins back
                last.classList.remove('facedown');
                last.style.transform = "rotateY(0deg)";

                setTimeout(() => {
                    // Phase 3: Total Cleanup
                    last.classList.remove('flipping');
                    last.style.transform = "";

                    flippedCount--;
                    if (flippedCount === 0) check();
                }, 160); // 160ms gives the 0.15s CSS transition room to breathe
            }, 150);
        }
    });

    if (flippedCount === 0) check();
}

function reposition(isLossSpread = false) {
    const isLandscape = window.innerHeight < 500;
    let spacing;

    if (isLossSpread) {
        // Calculate dynamic spacing: 
        // Use about 40% of the screen height divided by a typical column depth (e.g., 5-6 cards)
        // We cap it between 25px (min for readability) and 50px (max for aesthetics)
        const dynamicGap = Math.floor(window.innerHeight * 0.1);
        spacing = Math.min(Math.max(dynamicGap, 25), 50);

        // In tight landscape, we force a smaller cap to ensure visibility
        if (isLandscape) spacing = Math.min(spacing, 30);
    } else {
        // Your existing standard gameplay spacing
        spacing = isLandscape ? 20 : (window.innerWidth < 600 ? 16 : 22);
    }

    document.querySelectorAll('.column').forEach(col => {
        Array.from(col.children).forEach((c, idx) => {
            c.style.top = (idx * spacing) + "px";
            c.style.zIndex = idx;
        });
    });
}

function updateUI() { deckCountVal.innerText = deck.length; }

function getComment(score, isWin) {
    if (isWin) {
        if (score === 5) return "Phew! Close one.";
        if (score <= 9) return "Good job!";
        if (score <= 14) return "Way to go!";
        if (score <= 20) return "Wow!";
        return "Magnificent!";
    } else {
        if (score === -1) return "So close!";
        if (score >= -5) return "Nice try!";
        if (score >= -9) return "Bummer :/";
        return "Ouch! :(";
    }
}

function check() {
    const tableau = document.querySelectorAll('.column .card');
    const tableauCount = tableau.length;

    // DIAGNOSTIC LOGS
    console.log("--- TRECE DIAGNOSTIC ---");
    console.log("Tableau Card Count:", tableauCount);
    console.log("Deck Length:", deck.length);
    console.log("WinTimer Active?:", !!winTimer);
    console.log("Round Already Ended?:", roundEnded);

    if (lossTimer) {
        console.log("Clearing pending Loss Timer");
        clearTimeout(lossTimer);
        lossTimer = null;
    }

    // 1. THE WIN CHECK
    if (tableauCount === 0) {
        console.log("WIN DETECTED: Board is empty.");
        if (winTimer) {
            console.warn("WIN BLOCKED: A winTimer is already counting down.");
            return;
        }
        if (roundEnded) {
            console.warn("WIN BLOCKED: roundEnded is already true.");
            return;
        }

        console.log("Initiating Win Modal in 500ms...");
        winTimer = setTimeout(() => {
            console.log("Executing end(true) now.");
            end(true);
            winTimer = null;
        }, 500);
        return;
    }

    // 2. MOVE SCANNING
    const masterPool = [];
    document.querySelectorAll('.column').forEach(col => {
        if (col.lastElementChild && !col.lastElementChild.classList.contains('facedown')) {
            masterPool.push(col.lastElementChild);
        }
    });

    const discard = discardSlot.lastElementChild;
    if (discard) masterPool.push(discard);
    const active = activeSlot.lastElementChild;
    if (active) masterPool.push(active);

    let moves = false;
    for (let i = 0; i < masterPool.length; i++) {
        const v1 = parseInt(masterPool[i].dataset.v);
        if (v1 === 13) { moves = true; break; }
        for (let j = i + 1; j < masterPool.length; j++) {
            if (v1 + parseInt(masterPool[j].dataset.v) === 13) { moves = true; break; }
        }
        if (moves) break;
    }

    console.log("Moves Available:", moves);

    // 3. THE LOSS CHECK
    if (!moves && deck.length === 0) {
        console.log("LOSS DETECTED: No moves and deck is empty.");
        lossTimer = setTimeout(() => {
            if (!roundEnded) {
                console.log("Executing end(false) now.");
                end(false);
            }
            lossTimer = null;
        }, 1600);
    }
    console.log("------------------------");
}

function updateEndModalUI(isP, isC, isWin, score, msg, breakMessage, coffeeButtonHTML) {
    const modalBox = document.querySelector('#end-modal .modal-box');

    // 1. Reset standard styling
    modalBox.classList.remove('perfect-win-border');
    endTitle.style.textShadow = "none";
    endTitle.style.color = "var(--gold)";

    // 2. Apply special styling if Perfect Win
    if (isP) {
        modalBox.classList.add('perfect-win-border');
        endTitle.style.color = "#ffdf00";
        endTitle.style.textShadow = "0 0 10px rgba(255, 223, 0, 0.8)";
    }

    // 3. Update Text Content
    scoreVal.innerText = sessionScore;
    winsVal.innerText = wins;
    lossVal.innerText = losses;
    endTitle.innerText = isP ? "PERFECT!" : (isC ? "CLEAN SWEEP!" : (isWin ? "VICTORY" : "GAME OVER"));
    endComment.innerText = getComment(score, isWin);
    endMessage.innerHTML = `${msg}${breakMessage ? `<br>${breakMessage}` : ""}`;

    // 4. Handle Support Button
    const oldBtn = modalBox.querySelector('.support-btn-container');
    if (oldBtn) oldBtn.remove();

    if (coffeeButtonHTML) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'support-btn-container';
        btnContainer.style.marginTop = "30px";
        btnContainer.innerHTML = coffeeButtonHTML;
        modalBox.appendChild(btnContainer);
    }
}

function end(isWin) {
    if (roundEnded) return;
    roundEnded = true;

    const dc = discardSlot.children.length;
    const ac = activeSlot.children.length;
    let isP = isWin && (deck.length === 24 && dc === 0 && ac === 0);
    let isC = isWin && !isP && (dc === 0 && ac === 0);

    const score = isWin ? (isP ? 100 : (isC ? 10 + deck.length : 5 + deck.length)) : -document.querySelectorAll('.column .card').length;

    let msg = "";
    if (isWin) {
        if (isP) msg = "You cleared the board without drawing a single card. +100 Points!";
        else if (isC) msg = `10 pts + ${deck.length} deck bonus = ${score} Points!`;
        else msg = `5 pts + ${deck.length} deck bonus = ${score} Points!`;
    } else {
        const cardCount = Math.abs(score);
        const cardWord = cardCount === 1 ? "card" : "cards";
        const pointWord = cardCount === 1 ? "Point" : "Points";
        msg = `You left ${cardCount} ${cardWord} on the table. ${score} ${pointWord}.`;
    }

    if (isWin) {
        wins++;
        if (score >= 20) {
            triggerWinAnimation(); // THe card waterfall
        } else if (score >= 10) {
            triggerVortex(); // The New Medium Win Option
        } else {
            const fireworkCount = Math.max(deck.length * 100, 20);
            triggerFireworks(isP ? 1000 : fireworkCount);
        }
    }
    else {
        losses++;
        if (score > -2) {
            document.body.classList.add('shake-it');
            setTimeout(() => document.body.classList.remove('shake-it'), 1550);
        }
        else if (score > -10) {
            const cardsLeft = Math.abs(score);
            triggerLossAnimation(cardsLeft * 10);
        }
        else {
            triggerLossAnimation(100);
            triggerLightning();
            setTimeout(triggerLightning, 1200);
        }

        reposition(true);
        document.querySelectorAll('.facedown').forEach((c, idx) => {
            setTimeout(() => {
                c.classList.remove('facedown');
                c.style.opacity = "1";
                c.style.filter = "brightness(1.2) drop-shadow(0 0 2px white)";
            }, idx * 50);
        });
    }

    sessionScore += score;
    if (sessionScore > highScore) {
        highScore = sessionScore;
        localStorage.setItem('treceHighScore', highScore);
    }

    // --- TIERED MENTAL HEALTH BREAK LOGIC ---
    let cooldown = 0;
    let breakMessage = "";
    let coffeeButtonHTML = ""; // Defined separately for placement control

    // Create the support button with the white background and exact same size as other buttons
    const supportButton = `
                <a href="https://www.buymeacoffee.com/trece" target="_blank" class="support-btn">
                    <span style="font-size: 1.1rem;">☕</span> ENJOYING TRECE? SUPPORT US!
                </a>`;

    if (gameCounter >= 50 && gameCounter % 25 === 0) {
        cooldown = gameCounter;
        breakMessage = `<span class='break-alert'>${gameCounter} games? Time to go outside!</span>`;
        coffeeButtonHTML = supportButton; // Add button for 50+ games
    } else if (gameCounter === 30) {
        cooldown = 30;
        breakMessage = `<span class='break-alert'>30 Games: Mandatory 30 second break</span>`;
        coffeeButtonHTML = supportButton; // Add button for 30 games
    } else if (gameCounter === 20) {
        cooldown = 15;
        breakMessage = "<span class='break-alert' style='color: #ffaa00;'>20 Games: Take a breather</span>";
    } else if (gameCounter === 10) {
        cooldown = 5;
        breakMessage = "<span class='break-alert' style='color: var(--gold);'>10 Games: Quick stretch</span>";
    } else if (gameCounter === 5) {
        breakMessage = "<span class='break-alert' style='color: var(--gold); opacity: 0.8;'>5 games: Ready for a break?</span>";
    }

    // --- UI UPDATE & MODAL DISPLAY ---
    updateEndModalUI(isP, isC, isWin, score, msg, breakMessage, coffeeButtonHTML);

    //Check leaderboard for first win of session
    if (isWin && !CONFIG.HAS_PROMPTED) {
        checkLeaderboard(sessionScore);
        return; // <--- MUST return here so checkLeaderboard can manage the modal
    }

    if (isWin && CONFIG.HAS_PROMPTED) {
        // ONLY trigger the update/leaderboard if they set a new personal peak
        if (sessionScore > CONFIG.PEAK_SCORE) {
            CONFIG.PEAK_SCORE = sessionScore;

            supabaseClient
                .from('leaderboard')
                .upsert({
                    session_id: CONFIG.SESSION_ID,
                    initials: CONFIG.PLAYER_INITIALS,
                    score: CONFIG.PEAK_SCORE
                }, { onConflict: 'session_id' })
                .then(({ error }) => {
                    if (!error) {
                        console.log("🚀 New Peak! Showing the board.");
                        // Only show the board now that we've actually moved up
                        setTimeout(openLeaderboard, 1000);
                    }
                });
        }
    }


    endModal.style.display = 'flex';

    if (cooldown > 0) {
        isLocked = true;
        const mBtn = modalDealBtn;
        const bBtn = boardDealBtn;

        // Disable both buttons immediately
        mBtn.disabled = bBtn.disabled = true;

        let rem = cooldown;
        // Set initial text for both
        mBtn.innerText = bBtn.innerText = `WAIT (${rem}S)`;

        const timer = setInterval(() => {
            rem--;
            // Update both buttons every second
            mBtn.innerText = bBtn.innerText = `WAIT (${rem}S)`;

            if (rem <= 0) {
                clearInterval(timer);
                isLocked = false;
                mBtn.disabled = bBtn.disabled = false;
                // Restore original labels
                mBtn.innerText = bBtn.innerText = "DEAL AGAIN";
            }
        }, 1000);
    }
}

// Helper function for building the decks used in victory animations
function createAnimationDeck() {
    const style = getComputedStyle(document.documentElement);
    const redSuit = style.getPropertyValue('--suit-red').trim();
    const blackSuit = style.getPropertyValue('--suit-black').trim();
    const animZ = style.getPropertyValue('--z-animations').trim() || '12000';
    const cardW = style.getPropertyValue('--card-w').trim();
    const cardH = style.getPropertyValue('--card-h').trim();

    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const fullDeck = [];
    suits.forEach(s => ranks.forEach(r => fullDeck.push({ s, r })));
    fullDeck.sort(() => Math.random() - 0.5); // Shuffle

    return { fullDeck, redSuit, blackSuit, animZ, cardW, cardH };
}

function triggerVortex() {
    const { fullDeck, redSuit, blackSuit, animZ, cardW, cardH } = createAnimationDeck();

    fullDeck.forEach((data, i) => {
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'card vortex-card';
            card.style.position = 'fixed';
            card.style.zIndex = animZ;
            card.style.width = cardW;
            card.style.height = cardH;

            const isRed = data.s === '♥' || data.s === '♦';
            card.style.color = isRed ? redSuit : blackSuit;
            card.dataset.suit = data.s;

            card.innerHTML = `<div class="rank">${data.r}</div><div class="card-center-suit">${data.s}</div>`;
            card.style.left = '50vw';
            card.style.top = '50vh';
            card.style.marginLeft = `calc(${cardW} / -2)`;
            card.style.marginTop = `calc(${cardH} / -2)`;

            document.body.appendChild(card);

            let angle = 0, radius = 0;
            const speed = 0.03 + Math.random() * 0.05;
            const growth = 2 + Math.random() * 3; // Wider spiral for 52 cards
            const startAngle = Math.random() * Math.PI * 2;

            const anim = setInterval(() => {
                angle += speed;
                radius += growth;
                const x = Math.cos(angle + startAngle) * radius;
                const y = Math.sin(angle + startAngle) * radius;
                card.style.transform = `translate(${x}px, ${y}px) rotate(${angle * 60}deg)`;
                card.style.opacity = 1 - (radius / 900);
                if (radius > 900) { clearInterval(anim); card.remove(); }
            }, 20);
        }, i * 60); // Snappy delivery
    });
}

function triggerWinAnimation() {
    const { fullDeck, redSuit, blackSuit, animZ, cardW, cardH } = createAnimationDeck();

    fullDeck.forEach((data, i) => {
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.position = 'fixed';
            card.style.zIndex = animZ;
            card.style.width = cardW;
            card.style.height = cardH;

            // Apply theme-aware colors
            const isRed = data.s === '♥' || data.s === '♦';
            card.style.color = isRed ? redSuit : blackSuit;
            card.dataset.suit = data.s;

            card.innerHTML = `<div class="rank">${data.r}</div><div class="card-center-suit">${data.s}</div>`;
            card.style.left = Math.random() * 90 + 'vw'; // Keep slightly away from edges
            card.style.top = '-150px';
            document.body.appendChild(card);

            // Gravity Logic
            let velocityY = 0, posY = -150;
            const gravity = 0.6, bounce = -0.5, cH = parseFloat(cardH) || 128;

            const anim = setInterval(() => {
                velocityY += gravity;
                posY += velocityY;
                if (posY + cH > window.innerHeight) {
                    posY = window.innerHeight - cH;
                    velocityY *= bounce;
                }
                card.style.top = posY + 'px';
                if (Math.abs(velocityY) < 0.3 && posY > window.innerHeight - (cH + 10)) {
                    clearInterval(anim);
                    setTimeout(() => {
                        card.style.transition = "opacity 1.5s ease";
                        card.style.opacity = "0";
                        setTimeout(() => card.remove(), 1500);
                    }, 1000);
                }
            }, 20);
        }, i * 80); // Faster stagger for 52 cards
    });
}

function triggerLossAnimation(count = 20) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const drop = document.createElement('div');
            drop.className = 'firework';
            drop.innerText = ['♠', '♥', '♦', '♣'][Math.floor(Math.random() * 4)];
            drop.style.cssText = `position:fixed; left:${Math.random() * 100}vw; top:-50px; color:rgba(255,255,255,0.6); font-size:2.5rem; pointer-events:none; z-index:${zAnim};`;
            document.body.appendChild(drop);

            drop.animate([
                { transform: 'translateY(0)', opacity: 0.9 },
                { transform: `translateY(${window.innerHeight + 50}px)`, opacity: 0.1 }
            ], { duration: 2500, easing: 'linear' }).onfinish = () => drop.remove();
        }, i * 100); // Shorter interval for heavy rain
    }
}

function triggerLightning() {
    const flash = document.createElement('div');
    const isMidnight = document.body.classList.contains('midnight-mode');
    const flashColor = isMidnight ? "#1a2c4e" : "#fffdf5";
    flash.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:${flashColor}; opacity:0; z-index:${zAnim}; pointer-events:none;`;

    document.body.appendChild(flash);

    // Multi-strike pattern: Strike 1 (Fast), Gap, Strike 2 (Stronger)
    flash.animate([
        { opacity: 0, offset: 0 },
        { opacity: 0.5, offset: 0.1 },  // First quick burst
        { opacity: 0, offset: 0.2 },    // Back to dark
        { opacity: 0, offset: 0.3 },    // Pause...
        { opacity: 0.8, offset: 0.4 },  // Big main strike
        { opacity: 0, offset: 1.0 }     // Fade out slowly
    ], {
        duration: 600,
        easing: 'ease-out'
    }).onfinish = () => flash.remove();
}

function triggerFireworks(count) {
    const colors = getThemeColors();
    const palette = [colors.gold, '#ffffff', colors.red];
    for (let i = 0; i < count; i++) {
        const f = document.createElement('div');
        f.className = 'firework';
        f.style.zIndex = zAnim;
        f.innerText = ['♠', '♥', '♦', '♣'][getCryptoRandom(4)];
        f.style.color = palette[getCryptoRandom(3)];
        f.style.left = '50vw';
        f.style.top = '50vh';

        // Center the element on its coordinates and start invisible
        f.style.transform = 'translate(-50%, -50%)';
        f.style.opacity = '0';

        document.body.appendChild(f);

        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 600;

        f.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }
        ], {
            duration: 1500 + Math.random() * 1000,
            fill: 'forwards'
        });

        setTimeout(() => f.remove(), 2500);
    }
}

function toggleDisplay(element, forceShow = null) {
    if (!element) return;
    if (forceShow !== null) {
        element.style.display = forceShow ? 'flex' : 'none';
        return;
    }
    element.style.display = (element.style.display === 'flex' || element.style.display === 'block') ? 'none' : 'flex';
}

function openRules() {
    const modalHigh = document.getElementById('modal-high-score');
    if (modalHigh) modalHigh.innerText = highScore;
    toggleDisplay(rulesModal, true);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function toggleTheme() {
    const body = document.body;
    // We look for the icon in the header OR the modal
    const icon = themeIcon;

    if (icon) {
        icon.classList.add('theme-spinning');
    }

    body.classList.toggle('midnight-mode');

    const isMidnight = body.classList.contains('midnight-mode');

    // Update the icon if it exists
    if (icon) {
        icon.innerText = isMidnight ? "☀️" : "🌙";
    }

    localStorage.setItem('treceTheme', isMidnight ? 'midnight' : 'classic');

    // Clean up animation class
    setTimeout(() => {
        if (icon) icon.classList.remove('theme-spinning');
    }, 500);
}

function toggleOptions() {
    toggleDisplay(optionsModal);
}

function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        red: style.getPropertyValue('--suit-red').trim(),
        black: style.getPropertyValue('--suit-black').trim(),
        gold: style.getPropertyValue('--gold').trim()
    };
}

function setHandedness(hand) {
    const scaler = document.getElementById('scaler');
    const lBtn = document.getElementById('left-hand-btn');
    const rBtn = document.getElementById('right-hand-btn');

    if (hand === 'right') {
        scaler.classList.add('right-handed-layout');
    } else {
        scaler.classList.remove('right-handed-layout');
    }

    // Update button styles: Selected gets solid gold, unselected gets outline
    if (lBtn && rBtn) {
        const activeStyle = { background: "var(--gold)", color: "#051a05", opacity: "1" };
        const inactiveStyle = { background: "transparent", color: "var(--gold)", opacity: "0.6" };

        Object.assign(lBtn.style, hand === 'left' ? activeStyle : inactiveStyle);
        Object.assign(rBtn.style, hand === 'right' ? activeStyle : inactiveStyle);
    }

    localStorage.setItem('treceHandedness', hand);
}

// Helper for your specific wording requirements
function getRankWord(rank) {
    const words = ["highest", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
    return words[rank - 1] || "top";
}

function showInitialsEntry(rank, timeframe) {
    if (CONFIG.HAS_PROMPTED) return;

    const rankWord = getRankWord(rank);
    const entryArea = document.getElementById('high-score-entry');
    const messageDisplay = entryArea.querySelector('p');

    // Updated line to include the score value
    messageDisplay.innerHTML = `You got the ${rank !== 1 ? rankWord + ' ' : ''}highest score ${timeframe}!<br>` +
        `<span style="font-size: 1.4rem; color: #fff;">${sessionScore} POINTS</span>`;

    entryArea.style.display = 'block';
    hasPromptedThisSession = true;
}

async function submitScore() {
    const initialsInput = document.getElementById('initials-input');
    const initials = initialsInput.value.toUpperCase().trim();
    if (initials.length !== 3) return alert("Enter 3 initials.");

    CONFIG.PLAYER_INITIALS = initials;
    CONFIG.PEAK_SCORE = sessionScore;
    CONFIG.HAS_PROMPTED = true;

    const { error } = await supabaseClient
        .from('leaderboard')
        .upsert(
            {
                session_id: CONFIG.SESSION_ID, // The hidden ID
                initials: initials,    // The displayed name
                score: sessionScore
            },
            { onConflict: 'session_id' } // Always update based on the session, not the name
        );

    if (!error) {
        document.getElementById('initials-input').value = ''; // <--- Clear the box
        document.getElementById('high-score-entry').style.display = 'none';
        toggleDisplay(endModal, false); // Closes endModal via viewBoard functionality
        openLeaderboard();
    }
}

function openLeaderboard() {
    toggleDisplay(optionsModal, false);
    toggleDisplay(leaderboardModal, true);
    loadLeaderboard('all'); // Default to All-Time
    fetchGlobalRank(); //
}

async function loadLeaderboard(timeframe) {
    // 1. UI Feedback: Update Active Tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${timeframe}`).classList.add('active');

    const body = document.getElementById('leaderboard-body');
    const loader = document.getElementById('leaderboard-loader');

    body.innerHTML = '';
    loader.style.display = 'block';

    // 2. Build Query
    let query = supabaseClient
        .from('leaderboard')
        .select('initials, score, created_at, session_id') // <--- Add session_id here
        .order('score', { ascending: false })
        .limit(10);

    // Apply Time Filters
    if (timeframe !== 'all') {
        const date = new Date();
        if (timeframe === 'week') date.setDate(date.getDate() - 7);
        if (timeframe === 'month') date.setMonth(date.getMonth() - 1);
        if (timeframe === 'year') date.setFullYear(date.getFullYear() - 1);
        query = query.gte('created_at', date.toISOString());
    }

    // 3. Execute and Render
    const { data, error } = await query;
    loader.style.display = 'none';

    if (error) {
        body.innerHTML = '<tr><td colspan="3">ERROR LOADING DATA</td></tr>';
        return;
    }

    if (data.length === 0) {
        body.innerHTML = '<tr><td colspan="3">NO SCORES YET</td></tr>';
        return;
    }

    data.forEach((entry, index) => {
        // Check if this row belongs to the current user's session
        const isCurrentUser = entry.session_id === CONFIG.SESSION_ID;

        // Add a special 'current-user' class if it matches
        const rowClass = isCurrentUser ? 'class="current-user-row"' : '';

        const row = `
                <tr ${rowClass}>
                    <td>${index + 1}</td>
                    <td style="${isCurrentUser ? 'color: #fff; text-shadow: 0 0 10px var(--gold);' : ''}">${entry.initials}</td>
                    <td>${entry.score}</td>
                </tr>
            `;
        body.innerHTML += row;
    });
}

async function checkLeaderboard(playerScore) {
    console.log("🔍 Checking eligibility for score:", playerScore);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    try {
        const { data: allTime, error: atError } = await supabaseClient
            .from('leaderboard')
            .select('score')
            .order('score', { ascending: false })
            .limit(10);

        if (atError) throw atError;

        let rank = 0;
        let timeframe = "";

        // --- UPDATED SAFETY CHECK ---
        const bottomScore = (allTime && allTime.length > 0) ? allTime[allTime.length - 1].score : 0;

        if (!allTime || allTime.length < 10 || playerScore > bottomScore) {
            timeframe = "ever";
            rank = calculateRank(playerScore, allTime || []);
        } else {
            const { data: weekly, error: wError } = await supabaseClient
                .from('leaderboard')
                .select('score')
                .order('score', { ascending: false })
                .gte('created_at', oneWeekAgo.toISOString())
                .limit(10);

            if (wError) throw wError;

            // --- UPDATED WEEKLY SAFETY CHECK ---
            const bottomWeekly = (weekly && weekly.length > 0) ? weekly[weekly.length - 1].score : 0;

            if (!weekly || weekly.length < 10 || playerScore > bottomWeekly) {
                timeframe = "this week";
                rank = calculateRank(playerScore, weekly || []);
            }
        }

        if (rank > 0) {
            console.log(`🏆 Qualified! Rank: ${rank} Timeframe: ${timeframe}`);

            // ENSURE THIS MODAL TRIGGER IS HERE:
            showInitialsEntry(rank, timeframe);
            endModal.style.display = 'flex'; // <--- Make sure this line exists!
        } else {
            console.log("😅 Not quite a high score.");
            endModal.style.display = 'flex';
        }
    } catch (err) {
        console.error("❌ Leaderboard Check Failed:", err.message);
        endModal.style.display = 'flex';
    }
}

function calculateRank(score, list) {
    if (!list || list.length === 0) return 1;
    for (let i = 0; i < list.length; i++) {
        if (score > list[i].score) return i + 1;
    }
    return Math.min(list.length + 1, 10);
}

// Rules Modal Tab Navigation
function switchRulesTab(tabName) {
    // Hide all contents
    ['rules', 'scoring', 'about'].forEach(tab => {
        document.getElementById(`tab-${tab}-content`).style.display = 'none';
        document.getElementById(`rules-tab-${tab}`).classList.remove('active');
    });

    // Show selected
    document.getElementById(`tab-${tabName}-content`).style.display = 'block';
    document.getElementById(`rules-tab-${tabName}`).classList.add('active');
}

async function fetchGlobalRank() {
    // Use the Peak score for the rank calculation
    if (CONFIG.PEAK_SCORE <= 0) return;

    const { count, error } = await supabaseClient
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('score', CONFIG.PEAK_SCORE); // Compare against Peak

    if (!error) {
        const footer = document.getElementById('global-rank-footer');
        const rankVal = document.getElementById('user-rank-val');

        footer.style.display = 'block';
        rankVal.innerText = `#${count + 1}`;
    }
}


window.onload = () => {
    // Cache the Slots
    activeSlot = document.getElementById('active-slot');
    discardSlot = document.getElementById('discard-slot');
    successSlot = document.getElementById('success-slot');
    deckSlot = document.getElementById('deck-slot');

    // Cache the UI Labels
    scoreVal = document.getElementById('score-val');
    winsVal = document.getElementById('wins-val');
    lossVal = document.getElementById('loss-val');
    deckCountVal = document.getElementById('deck-count');
    gameVal = document.getElementById('game-val');

    // Cache the Modal Elements
    endModal = document.getElementById('end-modal');
    endTitle = document.getElementById('end-title');
    endMessage = document.getElementById('end-message');
    endComment = document.getElementById('end-comment');
    modalDealBtn = document.getElementById('modal-deal-btn');
    boardDealBtn = document.getElementById('board-deal-btn');
    rulesModal = document.getElementById('rules-modal');
    optionsModal = document.getElementById('options-modal');
    leaderboardModal = document.getElementById('leaderboard-modal');
    themeIcon = document.getElementById('theme-icon');

    const submitBtn = document.getElementById('submit-score-btn');
    if (submitBtn) submitBtn.onclick = submitScore;

    // Ensure it's hidden on start
    if (leaderboardModal) leaderboardModal.style.display = 'none';

    // Sync Theme & Handedness
    const savedTheme = localStorage.getItem('treceTheme');
    if (savedTheme === 'midnight') {
        document.body.classList.add('midnight-mode');
        const icon = themeIcon;
        if (icon) icon.innerText = "☀️";
    }

    const savedHand = localStorage.getItem('treceHandedness') || 'left';
    setHandedness(savedHand);

    document.getElementById('initials-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            submitScore();
        }
    });

    initGame();
}
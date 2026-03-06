 /* ALL LOGIC REMAINS IDENTICAL: 
       - Deep Scan Logic
       - Tiered Feedback Phrases
       - Fisher-Yates Shuffle with cut
       - 1.6s Delay on Loss
    */

    let wins = 0, losses = 0, gameCounter = 1;
    let lossTimer = null; // Tracks the pending "Game Over"
    let winTimer = null; // New variable to protect the victory trigger
    let deck = [], selectedCard = null, sessionScore = 0, roundEnded = false, isLocked = false;
    let highScore = localStorage.getItem('treceHighScore') || 0; // Loads the high score from the user's device

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
        if (winTimer) { clearTimeout(winTimer); winTimer = null; }
        if (isLocked) return;
        if (roundEnded) { gameCounter++; document.getElementById('game-val').innerText = gameCounter; }
        roundEnded = false; selectedCard = null;
        document.getElementById('end-modal').style.display = 'none';
        document.getElementById('rules-modal').style.display = 'none';
        
        deck = [];
        const suits = [{s:'♠',c:'black'},{s:'♥',c:'#d32f2f'},{s:'♦',c:'#d32f2f'},{s:'♣',c:'black'}];
        const names = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        
        // 1. Create the sorted deck
        suits.forEach(suit => names.forEach((name, i) => deck.push({n:name, v:i+1, s:suit.s, c:suit.c})));

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
        const ds = document.getElementById('deck-slot');
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
        div.dataset.v = data.v; 
        div.style.color = data.c;
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
        const success = document.getElementById('success-slot');
        const sRect = success.getBoundingClientRect();
        cards.forEach((el, i) => {
            const eRect = el.getBoundingClientRect();
            el.classList.add('flying', 'in-transit');
            el.style.transform = `translate(${sRect.left - eRect.left}px, ${sRect.top - eRect.top}px) scale(1.1)`;
            setTimeout(() => {
                el.classList.remove('flying', 'selected');
                el.style.transform = 'none'; el.style.top = '0px';
                el.style.zIndex = success.children.length + 100;
                success.appendChild(el);

                // Hand off the logic to the centralized check()
                if(i === cards.length-1) { 
                    reposition(); 
                    reveal(); 
                }
            }, 300);
        });
    }

    function drawCard() {
        if (deck.length === 0 || roundEnded) return;
        if (selectedCard) {
            selectedCard.classList.remove('selected');
            selectedCard = null;
        }
        const active = document.getElementById('active-slot'), discard = document.getElementById('discard-slot'), ds = document.getElementById('deck-slot');
        if (active.children.length > 0 && active.children[0].classList.contains('in-transit')) {
        return;
        }
        if (active.children.length > 0) {
            const old = active.children[0];
            old.style.zIndex = "100";
            old.style.transform = `translateX(${active.offsetWidth * 1.2}px)`;
            setTimeout(() => { old.style.transform = "none"; old.style.zIndex = ""; discard.appendChild(old); reposition(); }, 150);
        }
        if(ds.children.length > 0) {
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
        
        // 1. Immediate Win Check (Board is empty)
        const boardCards = document.querySelectorAll('.column .card').length;
        if (boardCards === 0) { check(); return; }

        columns.forEach(col => {
            if (col.children.length > 0) {
                const last = col.lastElementChild;
                // 2. Identify cards that NEED to flip
                if (last.classList.contains('facedown')) {
                    flippedCount++;
                    last.style.transform = "rotateY(90deg)";
                    setTimeout(() => { 
                        last.classList.remove('facedown'); 
                        last.style.transform = "rotateY(0deg)";
                        
                        flippedCount--;
                        // 3. THE FIX: Only rebuild the masterPool AFTER the last flip
                        if (flippedCount === 0) check(); 
                    }, 150); // Increased to 150ms to ensure DOM stability
                }
            }
        });

        // 4. Fallback: If no cards needed to flip, check the board state anyway
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

    function updateUI() { document.getElementById('deck-count').innerText = deck.length; }

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

        const discard = document.getElementById('discard-slot').lastElementChild;
        if (discard) masterPool.push(discard);
        const active = document.getElementById('active-slot').lastElementChild;
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

    function end(isWin) {
        if (roundEnded) return; 
        roundEnded = true;
        
        const dc = document.getElementById('discard-slot').children.length;
        const ac = document.getElementById('active-slot').children.length;
        let isP = isWin && (deck.length === 24 && dc === 0 && ac === 0);
        let isC = isWin && !isP && (dc === 0 && ac === 0 && deck.length > 0);
        
        const score = isWin ? (isP ? 100 : (isC ? 10 + deck.length : 5 + deck.length)) : -document.querySelectorAll('.column .card').length;
        
        let msg = "";
        if (isWin) {
            if (isP) msg = "PERFECT! You cleared the board without drawing a single card. +100 Points!";
            else if (isC) msg = `CLEAN SWEEP! 10 pts + ${deck.length} deck bonus = ${score} Points!`;
            else msg = `Victory! 5 pts + ${deck.length} deck bonus = ${score} Points!`;
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
                triggerFireworks(isP ? 120 : 60); // Small fireworks for small win
            }
        }
         else { 
            losses++; 
            if (score > -2) {
                document.body.classList.add('shake-it');
                setTimeout(() => document.body.classList.remove('shake-it'), 1550);
                }
            else if (score > -10) {
               triggerLossAnimation(20);
            } 
            else {
                triggerLossAnimation(80);
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
                <button onclick="window.open('https://www.buymeacoffee.com/trece', '_blank')" 
                style="background: rgba(255, 255, 255, 0.85);
                        color: #1a1a1a; /* Dark charcoal for high contrast */
                        border: 1px solid rgba(0,0,0,0.1); /* Subtle edge definition */
                        width: 100%;
                        margin: 50px auto 0 auto;
                        font-size: 0.8rem;
                        border-radius: 6px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        gap: 8px; 
                        height: 38px; 
                        font-family: sans-serif; 
                        font-weight: bold;
                        cursor: pointer;">
                    <span style="font-size: 1.1rem;">☕</span> ENJOYING TRECE? SUPPORT US!
                </button>`;

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
        document.getElementById('score-val').innerText = sessionScore;
        document.getElementById('wins-val').innerText = wins; 
        document.getElementById('loss-val').innerText = losses;
        document.getElementById('end-title').innerText = isP ? "PERFECT!" : (isC ? "CLEAN SWEEP!" : (isWin ? "VICTORY" : "GAME OVER"));
        document.getElementById('end-comment').innerText = getComment(score, isWin);
        
        // Set the main text content
        document.getElementById('end-message').innerHTML = `${msg}${breakMessage ? `<br>${breakMessage}` : ""}`;

        // IMPORTANT: Clear any previous coffee button and re-insert at the bottom if needed
        // We append the button after the primary action button
        const modalBox = document.querySelector('#end-modal .modal-box');
        modalBox.classList.remove('perfect-win-border');

        if (isP) {
            modalBox.classList.add('perfect-win-border');
            // 1. Set the text content first
        document.getElementById('end-message').innerHTML = `${msg}${breakMessage ? `<br>${breakMessage}` : ""}`;

        // 2. Identify the modal box
        const modalBox = document.querySelector('#end-modal .modal-box');
        modalBox.classList.remove('perfect-win-border');

        if (isP) {
            modalBox.classList.add('perfect-win-border');
            document.getElementById('end-title').style.color = "#ffdf00";
            document.getElementById('end-title').style.textShadow = "0 0 10px rgba(255, 223, 0, 0.8)";
        } else {
            document.getElementById('end-title').style.color = "var(--gold)";
            document.getElementById('end-title').style.textShadow = "none";
        }

        // 3. Re-insert the support button at the very bottom
        const oldBtn = modalBox.querySelector('.support-btn-container');
        if (oldBtn) oldBtn.remove();

        if (coffeeButtonHTML) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'support-btn-container';
            btnContainer.style.marginTop = "30px"; // Adds space from "View Board"
            btnContainer.innerHTML = coffeeButtonHTML;
            modalBox.appendChild(btnContainer);
        }
        } else {
            // Reset title color for normal games
            document.getElementById('end-title').style.color = "var(--gold)";
        }
        
        // Remove old support button if it exists to avoid duplicates
        const oldBtn = modalBox.querySelector('.support-btn-container');
        if (oldBtn) oldBtn.remove();

        if (coffeeButtonHTML) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'support-btn-container';
            btnContainer.innerHTML = coffeeButtonHTML;
            modalBox.appendChild(btnContainer); // Places it at the very bottom
        }

        document.getElementById('end-modal').style.display = 'flex';

        if (cooldown > 0) {
        isLocked = true;
        const mBtn = document.getElementById('modal-deal-btn');
        const bBtn = document.getElementById('board-deal-btn');
        
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

    function triggerVortex() {
        const suits = ['♠', '♥', '♦', '♣'];
        const colors = ['black', '#d32f2f', '#d32f2f', 'black'];
        const count = 25;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const card = document.createElement('div');
                const sIdx = Math.floor(Math.random() * 4);
                card.className = 'vortex-card';
                card.style.color = colors[sIdx];
                card.innerHTML = suits[sIdx];
                card.style.left = '50vw';
                card.style.top = '50vh';
                document.body.appendChild(card);

                let angle = 0;
                let radius = 0;
                // SLOWED DOWN: Lower speed and growth values
                const speed = 0.04 + Math.random() * 0.03; // Was 0.1 - 0.3
                const growth = 1.2 + Math.random() * 1.8; // Was 2 - 7
                const startAngle = Math.random() * Math.PI * 2;

                const anim = setInterval(() => {
                    angle += speed;
                    radius += growth;
                    
                    const x = Math.cos(angle + startAngle) * radius;
                    const y = Math.sin(angle + startAngle) * radius;
                    const rotation = angle * 40; // Slightly slower card spinning

                    card.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                    
                    // Opacity fades out slower as well
                    card.style.opacity = 1 - (radius / 700);

                    if (radius > 700) {
                        clearInterval(anim);
                        card.remove();
                    }
                }, 20);
            }, i * 120); // Staggered slightly more (was 80ms)
        }
    }

    function triggerWinAnimation() {
        const container = document.body;
        const cardCount = 40; // Number of cards in the waterfall
        const suits = ['♠', '♥', '♦', '♣'];
        const colors = ['black', '#d32f2f', '#d32f2f', 'black'];

        for (let i = 0; i < cardCount; i++) {
            setTimeout(() => {
                const card = document.createElement('div');
                const suitIdx = Math.floor(Math.random() * 4);
                card.className = 'card';
                card.style.position = 'fixed';
                card.style.zIndex = '5000';
                card.style.width = '80px';
                card.style.height = '112px';
                card.style.left = Math.random() * 100 + 'vw';
                card.style.top = '-120px';
                card.style.color = colors[suitIdx];
                card.innerHTML = `<div class="rank">${['A','J','Q','K'][Math.floor(Math.random()*4)]}</div>
                                <div class="card-center-suit">${suits[suitIdx]}</div>`;
                
                container.appendChild(card);

                let velocityY = 0;
                let posX = parseFloat(card.style.left);
                let posY = -120;
                const gravity = 0.5;
                const bounce = -0.7;

                const anim = setInterval(() => {
                    velocityY += gravity;
                    posY += velocityY;

                    // Bounce off the bottom
                    if (posY + 112 > window.innerHeight) {
                        posY = window.innerHeight - 112;
                        velocityY *= bounce;
                    }

                    card.style.top = posY + 'px';

                    // Remove card after it stops bouncing or falls off
                    if (posY > window.innerHeight + 200 || Math.abs(velocityY) < 0.1 && posY > window.innerHeight - 120) {
                        clearInterval(anim);
                        card.remove();
                    }
                }, 20);
            }, i * 150); // Stagger the cards
        }
    }

    function triggerLossAnimation(count = 20) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const drop = document.createElement('div');
                drop.className = 'firework'; 
                drop.innerText = ['♠', '♥', '♦', '♣'][Math.floor(Math.random() * 4)];
                drop.style.cssText = `position:fixed; left:${Math.random()*100}vw; top:-50px; color:rgba(255,255,255,0.6); font-size:2.5rem; pointer-events:none; z-index:9999;`;
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
        // Ensure it sits behind the rain but in front of the board
        flash.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#fffdf5; opacity:0; z-index:9998; pointer-events:none;`;        document.body.appendChild(flash);

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
        for (let i = 0; i < count; i++) {
            const f = document.createElement('div'); f.className = 'firework';
            f.innerText = ['♠', '♥', '♦', '♣'][getCryptoRandom(4)];
            f.style.color = ['var(--gold)','#fff','#ff5252'][getCryptoRandom(3)];
            f.style.left = '50vw'; f.style.top = '50vh'; document.body.appendChild(f);
            const a = Math.random()*Math.PI*2, d = Math.random()*600;
            f.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px) scale(0)`,opacity:0}], 1500 + Math.random()*1000);
            setTimeout(() => f.remove(), 2500);
        }
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

    function openRules() {
        const modalHigh = document.getElementById('modal-high-score');
        if (modalHigh) modalHigh.innerText = highScore;
        document.getElementById('rules-modal').style.display = 'flex'; }
    function closeRules() { document.getElementById('rules-modal').style.display = 'none'; }
    function viewBoard() { document.getElementById('end-modal').style.display = 'none'; }

    function toggleTheme() {
        const body = document.body;
        const icon = document.getElementById('theme-icon');
        
        // 1. Toggle the class
        body.classList.toggle('midnight-mode');
        
        // 2. Update the Icon and Save Preference
        if (body.classList.contains('midnight-mode')) {
            icon.innerText = "☀️"; // Show sun for "Back to Light"
            localStorage.setItem('treceTheme', 'midnight');
        } else {
            icon.innerText = "🌙"; // Show moon for "Go Dark"
            localStorage.setItem('treceTheme', 'classic');
        }
    }

    window.onload = initGame;
    if (localStorage.getItem('treceTheme') === 'midnight') {
    document.body.classList.add('midnight-mode');
    }
    // Check for saved theme on startup
    const savedTheme = localStorage.getItem('treceTheme');
    if (savedTheme === 'midnight') {
        document.body.classList.add('midnight-mode');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.innerText = "☀️";
    }
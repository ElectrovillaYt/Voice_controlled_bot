let joystick = null;
let joystickContainer = null;
let centerX = 0;
let centerY = 0;
let maxDistance = 70;
let activeDirection = "";
let isDragging = false;
let isMic_ON = false;

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.continuous = true;
recognition.interimResults = false;

let Mic_ON_Vector = `<svg xmlns="http://www.w3.org/2000/svg" width="35px" height="35px" fill="inherit"
        class="bi bi-mic-fill" viewBox="0 0 16 16">
        <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z" />
        <path
        d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5" />
        </svg>`;


let Mic_OFF_Vector = `<svg xmlns="http://www.w3.org/2000/svg" width="35px" height="35px" fill="inherit"
        class="bi bi-mic-mute-fill" viewBox="0 0 16 16">
        <path
        d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4 4 0 0 0 12 8V7a.5.5 0 0 1 1 0zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a5 5 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4m3-9v4.879L5.158 2.037A3.001 3.001 0 0 1 11 3" />
        <path d="M9.486 10.607 5 6.12V8a3 3 0 0 0 4.486 2.607m-7.84-9.253 12 12 .708-.708-12-12z" />
        </svg>`;

const initSpeech = () => {
    if (!recognition) return;
    recognition.start();
};

recognition.onresult = (event) => {
    const transcript = (event.results[event.results.length - 1][0].transcript)?.replace('.', "")?.replace("?", "").toLowerCase();
    if (transcript?.length > 0) {
        let direction = 0
        if (transcript.includes("forward") || transcript.includes("ahead")) direction = 1;
        else if (transcript.includes("back") || transcript.includes("reverse")) direction = -1;
        if (transcript.includes("left") || transcript.includes("ahead")) direction = -2;
        else if (transcript.includes("right") || transcript.includes("reverse")) direction = 2;
        else if (transcript.includes("stop") || transcript.includes("break")) direction = 0;
        sendDirectionCommand(direction)
    }
};
recognition.onend = () => {
        if(isMic_ON) {
            recognition.start();  
        }
}

recognition.onerror = (event) => alert(`Speech recognition error: ${event.error}`);

const changeMicState = () => {
    var micHolder = document.getElementById("mic-holder");
    var mic = document.getElementById("mic");
    mic.innerHTML = isMic_ON ? Mic_ON_Vector : Mic_OFF_Vector;
    if (isMic_ON) {
        micHolder.className = "mic-on-animation";
        mic.style.boxShadow = "0px 5px 15px rgba(0, 200, 255, 0.6)";
        initSpeech();
    }
    else {
        micHolder.className = "";
        micHolder.style.borderRadius = "200%"
        micHolder.style.backgroundColor = ""
        mic.style.boxShadow = "0px 5px 15px rgba(255, 64, 0, 0.35)";
        recognition.stop();
    }
};

changeMicState();


document.getElementById("mic").addEventListener('click', (e) => {
    e.preventDefault();
    isMic_ON = !isMic_ON;
    changeMicState();
});

const sendCommand = async (url) => {
    try {
        const response = await fetch(url);
    }
    catch (e) {
        console.error(e?.message ?? e?.error ?? e);
    }
}

const moveJoystick = (event) => {
    if (!isDragging) return;
    event.preventDefault();
    let touch = event.touches ? event.touches[0] : event;
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxDistance) {
        deltaX = (deltaX / distance) * maxDistance;
        deltaY = (deltaY / distance) * maxDistance;
    }
    joystick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    let adjustedAngle = angle + 90;
    if (adjustedAngle < 0) adjustedAngle += 360;

    const minActiveDistance = 0.8 * maxDistance;
    let direction = "0"; //stop (default)
    if (distance >= minActiveDistance) {
        if (adjustedAngle >= 315 || adjustedAngle < 45) {
            direction = 1;  // Forward
        } else if (adjustedAngle >= 45 && adjustedAngle < 135) {
            direction = 2; // Right
        } else if (adjustedAngle >= 135 && adjustedAngle < 225) {
            direction = -1; // Backward
        } else if (adjustedAngle >= 225 && adjustedAngle < 315) {
            direction = -2; // Left
        }
    }

    if (direction !== activeDirection) {
        activeDirection = direction;
        isMic_ON = false;
        changeMicState();
        sendDirectionCommand(direction);
    }
}

const sendDirectionCommand = (direction) => {
    if (direction === 1 || direction === -1 ||
        direction === -2 || direction === 2) {
        sendCommand("/motor?dir=" + direction);
    } else if (direction === 0) {
        sendCommand(`/motor?dir=${direction}`);
    }
}

const startJoystick = (event) => {
    isDragging = true;
    event.preventDefault();
}

const resetJoystick = () => {
    isDragging = false;
    joystick.style.transform = "translate(0px, 0px)";
    sendCommand("/motor?dir=0");
    activeDirection = "";
}

const adjustServoAngle = (servoID, cmd) => {
    isMic_ON = false;
    changeMicState();
    sendCommand(`/servo?s=${servoID}&a=` + cmd)
}

const adjustSpeed = (speed) => {
    isMic_ON = false;
    changeMicState();
    document.getElementById("speedValue").innerText = `${speed}%`;
    sendCommand(`/speed?s=${speed}`);
}

const setupJoystick = () => {
    joystick = document.getElementById("joystick");
    joystickContainer = document.getElementById("joystick-container");
    let rect = joystickContainer.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    joystick.addEventListener("mousedown", startJoystick);
    joystick.addEventListener("touchstart", startJoystick);
    document.addEventListener("mousemove", moveJoystick);
    document.addEventListener("touchmove", moveJoystick);
    document.addEventListener("mouseup", resetJoystick);
    document.addEventListener("touchend", resetJoystick);
}

document.addEventListener("DOMContentLoaded", () => {
    setupJoystick();
    document.getElementById("speed").value = "50%";
    document.getElementById("speedValue").innerText = "50%";
    // Initialize both servos to their rest positions.
    sendCommand('/servo?s=1&a=0');
    sendCommand('/servo?s=2&a=0');
});

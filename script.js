let activeScrollFrame = null;
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const musicButton = document.querySelector(".music-toggle");
const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

if (musicButton instanceof HTMLButtonElement && AudioContextConstructor) {
  const audioContext = new AudioContextConstructor();
  const musicGain = audioContext.createGain();
  musicGain.gain.value = 0.12;
  musicGain.connect(audioContext.destination);

  let musicBufferPromise = null;
  let musicSource = null;
  let isMusicMuted = false;
  let startPromise = null;

  const syncMusicButton = () => {
    musicButton.classList.toggle("is-muted", isMusicMuted);
    musicButton.classList.toggle("is-playing", audioContext.state === "running" && musicSource !== null);
    musicButton.setAttribute("aria-pressed", String(isMusicMuted));
    musicButton.setAttribute(
      "aria-label",
      isMusicMuted
        ? "Unmute background music"
        : musicSource && audioContext.state === "running"
          ? "Mute background music"
          : "Start background music",
    );
    musicButton.title = musicButton.getAttribute("aria-label");
  };

  const loadMusic = () => {
    if (!musicBufferPromise) {
      musicBufferPromise = fetch("Open.mp3")
        .then((response) => {
          if (!response.ok) throw new Error(`Audio request failed with status ${response.status}.`);
          return response.arrayBuffer();
        })
        .then((data) => audioContext.decodeAudioData(data));
    }
    return musicBufferPromise;
  };

  const startMusic = () => {
    if (isMusicMuted || (musicSource && audioContext.state === "running")) return Promise.resolve();
    if (startPromise) return startPromise;

    startPromise = (async () => {
      try {
        if (audioContext.state === "suspended") await audioContext.resume();
        if (isMusicMuted || audioContext.state !== "running") return;

        if (!musicSource) {
          const buffer = await loadMusic();
          if (isMusicMuted || audioContext.state !== "running") return;
          musicSource = audioContext.createBufferSource();
          musicSource.buffer = buffer;
          musicSource.loop = true;
          musicSource.connect(musicGain);
          musicSource.start();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") return;
        musicBufferPromise = null;
        musicButton.title = "Background music could not be loaded.";
        console.error("Background music could not start.", error);
      } finally {
        syncMusicButton();
      }
    })().finally(() => {
      startPromise = null;
    });
    return startPromise;
  };

  syncMusicButton();
  void startMusic();
  audioContext.addEventListener("statechange", syncMusicButton);

  musicButton.addEventListener("click", () => {
    if (!isMusicMuted && (!musicSource || audioContext.state !== "running")) {
      void startMusic();
      return;
    }

    isMusicMuted = !isMusicMuted;
    musicGain.gain.setTargetAtTime(isMusicMuted ? 0 : 0.12, audioContext.currentTime, 0.08);
    syncMusicButton();
    if (!isMusicMuted) void startMusic();
  });
} else if (musicButton instanceof HTMLButtonElement) {
  const backgroundAudio = new Audio("Open.mp3");
  backgroundAudio.loop = true;
  backgroundAudio.preload = "auto";
  backgroundAudio.volume = 0.12;
  let isMusicMuted = false;

  const syncMusicButton = () => {
    musicButton.classList.toggle("is-muted", isMusicMuted);
    musicButton.classList.toggle("is-playing", !backgroundAudio.paused);
    musicButton.setAttribute("aria-pressed", String(isMusicMuted));
    const label = isMusicMuted
      ? "Unmute background music"
      : backgroundAudio.paused
        ? "Start background music"
        : "Mute background music";
    musicButton.setAttribute("aria-label", label);
    musicButton.title = label;
  };

  const startMusic = async () => {
    try {
      await backgroundAudio.play();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) {
        console.error("Background music could not start.", error);
        musicButton.title = "Background music could not be loaded.";
      }
    } finally {
      syncMusicButton();
    }
  };

  syncMusicButton();
  void startMusic();
  musicButton.addEventListener("click", () => {
    if (!backgroundAudio.paused && !isMusicMuted) {
      isMusicMuted = true;
      backgroundAudio.pause();
    } else {
      isMusicMuted = false;
      void startMusic();
    }
    syncMusicButton();
  });
}

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  navigation?.classList.toggle("is-open", !isOpen);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || menuButton?.getAttribute("aria-expanded") !== "true") return;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Open navigation");
  navigation?.classList.remove("is-open");
  menuButton.focus();
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;

    event.preventDefault();
    if (activeScrollFrame !== null) cancelAnimationFrame(activeScrollFrame);

    const start = window.scrollY;
    const rootStyle = getComputedStyle(document.documentElement);
    const targetStyle = getComputedStyle(target);
    const destination = Math.max(
      0,
      Math.min(
        document.documentElement.scrollHeight - window.innerHeight,
        start +
          target.getBoundingClientRect().top -
          parseFloat(rootStyle.scrollPaddingTop) -
          parseFloat(targetStyle.scrollMarginTop),
      ),
    );

    if (reducedMotion.matches) {
      window.scrollTo(0, destination);
    } else {
      const duration = Math.min(1900, Math.max(700, Math.abs(destination - start) * 0.42));
      let animationStart = null;
      const animateScroll = (timestamp) => {
        if (animationStart === null) animationStart = timestamp;
        const progress = Math.min(1, (timestamp - animationStart) / duration);
        const easedProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        document.documentElement.scrollTop = start + (destination - start) * easedProgress;
        if (progress < 1) {
          activeScrollFrame = requestAnimationFrame(animateScroll);
        } else {
          activeScrollFrame = null;
        }
      };
      activeScrollFrame = requestAnimationFrame(animateScroll);
    }

    history.replaceState(null, "", link.hash);
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Open navigation");
    navigation?.classList.remove("is-open");
  });
});

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const animatedStages = document.querySelectorAll(".portrait-stage, .education-path, .academy-visual");
if (reducedMotion.matches || !("IntersectionObserver" in window)) {
  animatedStages.forEach((stage) => stage.classList.add("is-visible"));
} else {
  const stageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          stageObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 },
  );
  animatedStages.forEach((stage) => stageObserver.observe(stage));
}

const starField = document.querySelector(".star-field");
if (starField) {
  const placeStars = () => {
    const pageHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const pageWidth = document.documentElement.clientWidth;
    const textBounds = [];
    const textPadding = 90;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (!textNode.textContent.trim() || textNode.parentElement.closest(".star-field, .grain")) continue;

      const range = document.createRange();
      range.selectNodeContents(textNode);
      [...range.getClientRects()].forEach((rect) => {
        if (rect.width && rect.height) {
          textBounds.push({
            left: rect.left - textPadding,
            right: rect.right + textPadding,
            top: rect.top + window.scrollY - textPadding,
            bottom: rect.bottom + window.scrollY + textPadding,
          });
        }
      });
    }

    document.querySelectorAll(".hero-art, .portrait-stage, .academy-visual").forEach((movingArtwork) => {
      const rect = movingArtwork.getBoundingClientRect();
      textBounds.push({
        left: rect.left - 20,
        right: rect.right + 20,
        top: rect.top + window.scrollY - 20,
        bottom: rect.bottom + window.scrollY + 20,
      });
    });

    starField.replaceChildren();
    starField.style.height = `${pageHeight}px`;
    const starCount = Math.min(60, Math.max(20, Math.round(pageHeight / 130)));

    for (let index = 0; index < starCount; index += 1) {
      let left = 0;
      let top = 0;
      const fontSize = 5 + Math.random() * 5;
      let clear = false;

      for (let attempt = 0; attempt < 80; attempt += 1) {
        left = 12 + Math.random() * Math.max(1, pageWidth - fontSize - 24);
        top = 12 + Math.random() * Math.max(1, pageHeight - fontSize - 24);
        const centerX = left + fontSize / 2;
        const centerY = top + fontSize / 2;
        clear = !textBounds.some(
          (bounds) =>
            centerX >= bounds.left &&
            centerX <= bounds.right &&
            centerY >= bounds.top &&
            centerY <= bounds.bottom,
        );
        if (clear) break;
      }

      if (!clear) continue;
      const spark = document.createElement("span");
      spark.className = "star-spark";
      spark.textContent = index % 4 === 0 ? "✧" : "✦";
      spark.style.left = `${left}px`;
      spark.style.top = `${top}px`;
      spark.style.fontSize = `${fontSize}px`;
      spark.style.setProperty("--twinkle-duration", `${2.5 + Math.random() * 4}s`);
      spark.style.setProperty("--twinkle-delay", `${-Math.random() * 6}s`);
      starField.append(spark);
    }
  };

  let starPlacementFrame = 0;
  let resizeTimer = 0;
  const scheduleStarPlacement = () => {
    if (starPlacementFrame) cancelAnimationFrame(starPlacementFrame);
    starPlacementFrame = requestAnimationFrame(() => {
      starPlacementFrame = 0;
      placeStars();
    });
  };

  placeStars();
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(scheduleStarPlacement, 180);
    },
    { passive: true },
  );
  window.addEventListener("load", () => window.setTimeout(scheduleStarPlacement, 900), { once: true });
  document.addEventListener(
    "load",
    (event) => {
      if (event.target instanceof HTMLImageElement) scheduleStarPlacement();
    },
    true,
  );
  document.fonts?.ready.then(scheduleStarPlacement);
}

(function (window, document) {
  "use strict";

  var tmdb = window.TrailerHubTMDB;
  var state = {
    rows: [],
    rowEls: [],
    focusRow: 0,
    focusCol: 0,
    heroMovie: null,
    detailsMovie: null,
    pendingVideo: null,
    playerFallbackTimer: null,
    searchTimer: null,
    overlayTimer: null,
    lastFocused: null,
    lastActivation: 0
  };

  var rowConfigs = [
    { title: "Trending", path: "/trending/movie/week" },
    { title: "Popular", path: "/movie/popular" },
    { title: "Nos Cinemas", path: "/movie/now_playing" },
    { title: "Em Breve", path: "/movie/upcoming" },
    { title: "Ação", path: "/discover/movie", params: { with_genres: 28, sort_by: "popularity.desc" } },
    { title: "Comédia", path: "/discover/movie", params: { with_genres: 35, sort_by: "popularity.desc" } },
    { title: "Animação", path: "/discover/movie", params: { with_genres: 16, sort_by: "popularity.desc" } },
    { title: "Família", path: "/discover/movie", params: { with_genres: 10751, sort_by: "popularity.desc" } },
    { title: "Terror", path: "/discover/movie", params: { with_genres: 27, sort_by: "popularity.desc" } },
    { title: "Sci-Fi", path: "/discover/movie", params: { with_genres: 878, sort_by: "popularity.desc" } },
    { title: "Documentários", path: "/discover/movie", params: { with_genres: 99, sort_by: "popularity.desc" } },
    { title: "Séries", path: "/trending/tv/week" },
    { title: "Infantil", path: "/discover/movie", params: { with_genres: 10751, certification_country: "BR", sort_by: "popularity.desc" } },
    { title: "Continue explorando", path: "/movie/top_rated" }
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function titleOf(item) {
    return item.title || item.name || "Trailer Hub";
  }

  function yearOf(item) {
    var date = item.release_date || item.first_air_date || "";
    return date ? date.slice(0, 4) : "";
  }

  function ratingOf(item) {
    return item.vote_average ? Number(item.vote_average).toFixed(1) : "--";
  }

  function playLabel() {
    return '<span class="play-icon" aria-hidden="true"></span><span>Assistir trailer</span>';
  }

  function setHero(movie) {
    if (!movie) return;
    state.heroMovie = movie;

    byId("heroTitle").textContent = titleOf(movie);
    byId("heroMeta").textContent = [
      yearOf(movie),
      "Nota " + ratingOf(movie),
      movie.media_type === "tv" ? "Série" : "Filme",
      "Trailer"
    ].filter(Boolean).join("  •  ");
    byId("heroDescription").textContent = movie.overview || "Explore o trailer, veja detalhes e descubra a próxima história para assistir.";

    var hero = byId("hero");
    var backdrop = byId("heroBackdrop");
    var poster = byId("heroPoster");
    hero.className = "hero";

    backdrop.onload = function () {
      hero.className = "hero ready";
    };

    backdrop.src = tmdb.image(movie.backdrop_path, "original");
    poster.src = tmdb.image(movie.poster_path, "w500");
    poster.alt = titleOf(movie);
    setLinkHref(byId("heroPlay"), youtubeSearchUrl(movie));
  }

  function skeletonRow(title) {
    return [
      '<section class="row loading-row">',
      '<h2 class="row-title">' + escapeHtml(title) + '</h2>',
      '<div class="rail">',
      new Array(9).join('<div class="skeleton-card"></div>'),
      '</div>',
      '</section>'
    ].join("");
  }

  function createRow(config, rowIndex) {
    var section = document.createElement("section");
    section.className = "row";
    section.setAttribute("data-row-section", rowIndex);
    section.innerHTML = skeletonRow(config.title);
    byId("content").appendChild(section);
    state.rowEls[rowIndex] = section;
  }

  function makeCard(movie, rowIndex, colIndex) {
    var card = document.createElement("button");
    card.className = "card focusable";
    card.type = "button";
    card.setAttribute("data-row", rowIndex);
    card.setAttribute("data-col", colIndex);
    card.setAttribute("aria-label", titleOf(movie));
    card.setAttribute("onclick", "return TrailerHubActions.openCard(event, this)");

    var poster = tmdb.image(movie.poster_path, "w342");
    card.innerHTML = [
      '<span class="poster-wrap">',
      poster ? '<img class="poster lazy" loading="lazy" data-src="' + poster + '" alt="' + escapeHtml(titleOf(movie)) + '">' : '<span class="poster-fallback">' + escapeHtml(titleOf(movie)) + '</span>',
      '<span class="card-score">' + escapeHtml(ratingOf(movie)) + '</span>',
      '</span>',
      '<span class="card-title">' + escapeHtml(titleOf(movie)) + '</span>',
      '<span class="card-year">' + escapeHtml(yearOf(movie)) + '</span>'
    ].join("");

    bindActivate(card, function () {
      openDetails(movie);
    });

    card.onmouseenter = function () {
      card.className = "card focusable pointer-active";
      state.focusRow = rowIndex;
      state.focusCol = colIndex;
      state.lastFocused = card;
      setHero(movie);
    };

    card.onmouseover = card.onmouseenter;

    card.onmouseleave = function () {
      card.className = "card focusable";
    };

    card.onfocus = function () {
      state.focusRow = rowIndex;
      state.focusCol = colIndex;
      state.lastFocused = card;
      setHero(movie);
      keepFocusVisible(card);
    };

    return card;
  }

  function renderRow(rowIndex, title, movies) {
    var section = state.rowEls[rowIndex];
    var clean = (movies || []).filter(function (movie) {
      return movie && titleOf(movie) && movie.poster_path;
    }).slice(0, 20);

    state.rows[rowIndex] = clean;

    if (!clean.length) {
      section.innerHTML = '<h2 class="row-title">' + escapeHtml(title) + '</h2><div class="empty-state">Nada encontrado por aqui.</div>';
      return;
    }

    section.innerHTML = '<h2 class="row-title">' + escapeHtml(title) + '</h2><div class="rail"></div>';
    var rail = section.querySelector(".rail");
    clean.forEach(function (movie, colIndex) {
      rail.appendChild(makeCard(movie, rowIndex, colIndex));
    });

    observeImages(section);
    section.className = "row ready";

    if (!state.heroMovie && clean[0]) {
      setHero(clean[0]);
      setTimeout(function () {
        focusCard(0, 0);
      }, 250);
    }
  }

  function renderRowError(rowIndex, title, error) {
    state.rowEls[rowIndex].innerHTML = [
      '<h2 class="row-title">' + escapeHtml(title) + '</h2>',
      '<div class="empty-state">Não foi possível carregar esta fileira. ' + escapeHtml(error.message) + '</div>'
    ].join("");
  }

  function loadRow(config, rowIndex) {
    return tmdb.request(config.path, config.params || {})
      .then(function (data) {
        renderRow(rowIndex, config.title, data.results || []);
      })
      .catch(function (error) {
        renderRowError(rowIndex, config.title, error);
      });
  }

  function loadHome() {
    state.rows = [];
    state.rowEls = [];
    state.heroMovie = null;
    byId("content").innerHTML = "";
    rowConfigs.forEach(createRow);
    rowConfigs.forEach(loadRow);
  }

  function observeImages(root) {
    var images = root.querySelectorAll("img.lazy");

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(images, loadImage);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        loadImage(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "420px" });

    Array.prototype.forEach.call(images, function (image) {
      observer.observe(image);
    });
  }

  function loadImage(image) {
    if (!image || !image.getAttribute("data-src")) return;
    image.onload = function () {
      image.className = "poster loaded";
    };
    image.src = image.getAttribute("data-src");
    image.removeAttribute("data-src");
  }

  function focusCard(row, col) {
    if (!state.rows.length) return;
    row = Math.max(0, Math.min(row, state.rows.length - 1));
    if (!state.rows[row] || !state.rows[row].length) return;
    col = Math.max(0, Math.min(col, state.rows[row].length - 1));

    var card = document.querySelector('.card[data-row="' + row + '"][data-col="' + col + '"]');
    if (!card) return;
    card.focus();
    keepFocusVisible(card);
  }

  function keepFocusVisible(element) {
    if (!element || !element.scrollIntoView) return;
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  function openDetails(movie) {
    var panel = byId("detailsPanel");
    state.detailsMovie = movie;
    byId("detailsTitle").textContent = titleOf(movie);
    byId("detailsMeta").textContent = [yearOf(movie), "Nota " + ratingOf(movie), movie.media_type === "tv" ? "Série" : "Filme", "HD"].filter(Boolean).join("  •  ");
    byId("detailsOverview").textContent = movie.overview || "Trailer e detalhes disponíveis para este título.";
    byId("detailsBackdrop").src = tmdb.image(movie.backdrop_path, "original");
    byId("detailsPlay").innerHTML = playLabel();
    setLinkHref(byId("detailsPlay"), youtubeSearchUrl(movie));
    bindActivate(byId("detailsPlay"), function () {
      openTrailer(movie);
    });
    panel.className = "details-panel open";
    panel.setAttribute("aria-hidden", "false");
    byId("detailsPlay").focus();
  }

  function closeDetails(skipRestore) {
    byId("detailsPanel").className = "details-panel";
    byId("detailsPanel").setAttribute("aria-hidden", "true");
    state.detailsMovie = null;
    if (!skipRestore) restoreFocus();
  }

  function getTrailer(movie) {
    var type = movie.media_type === "tv" || movie.first_air_date ? "tv" : "movie";
    var path = "/" + type + "/" + movie.id + "/videos";

    return tmdb.request(path, {})
      .then(function (data) {
        return pickTrailer(data.results);
      })
      .then(function (videoId) {
        if (videoId) return videoId;
        return tmdb.request(path, { language: "en-US" }).then(function (data) {
          return pickTrailer(data.results);
        });
      });
  }

  function pickTrailer(results) {
    var videos = (results || []).filter(function (video) {
      return video.site === "YouTube" && video.key;
    });

    var preferred = videos.filter(function (video) {
      return video.type === "Trailer" && video.official;
    })[0] || videos.filter(function (video) {
      return video.type === "Trailer";
    })[0] || videos[0];

    return preferred ? preferred.key : null;
  }

  function openTrailer(movie) {
    var modal = byId("modal");
    var loading = byId("playerLoading");
    closeDetails(true);
    byId("playerTitle").textContent = titleOf(movie);
    modal.className = "modal open";
    modal.setAttribute("aria-hidden", "false");
    loading.className = "player-status visible";
    loading.textContent = "Clique recebido. Buscando trailer...";
    setLinkHref(byId("externalTrailerLink"), youtubeSearchUrl(movie));
    showPlayerOverlay();

    getTrailer(movie)
      .then(function (videoId) {
        if (!videoId) {
          loading.textContent = "Trailer não encontrado.";
          return;
        }

        playTrailer(videoId);
      })
      .catch(function () {
        loading.textContent = "Não foi possível carregar este trailer.";
      });
  }

  function playTrailer(videoId) {
    clearTimeout(state.playerFallbackTimer);
    state.pendingVideo = videoId;
    setLinkHref(byId("heroPlay"), youtubeWatchUrl(videoId));
    setLinkHref(byId("detailsPlay"), youtubeWatchUrl(videoId));
    setLinkHref(byId("externalTrailerLink"), youtubeWatchUrl(videoId));

    if (isWebOS()) {
      byId("playerLoading").textContent = "Abrindo trailer no YouTube...";
      window.location.href = youtubeWatchUrl(videoId);
      return;
    }

    loadTrailerIframe(videoId);
  }

  function loadTrailerIframe(videoId) {
    var url = "https://www.youtube.com/embed/" + encodeURIComponent(videoId) +
      "?autoplay=1&controls=1&rel=0&modestbranding=1&playsinline=0";

    byId("playerLoading").className = "player-status";
    byId("yt").innerHTML = '<iframe title="Trailer" src="' + url + '" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
  }

  function youtubeSearchUrl(movie) {
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(titleOf(movie) + " trailer");
  }

  function youtubeWatchUrl(videoId) {
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId);
  }

  function setLinkHref(link, href) {
    if (link && href) link.setAttribute("href", href);
  }

  function isWebOS() {
    return /web0s|webos|webOS|SmartTV|NetCast/i.test(window.navigator.userAgent || "");
  }

  function closeModal() {
    byId("modal").className = "modal";
    byId("modal").setAttribute("aria-hidden", "true");
    clearTimeout(state.playerFallbackTimer);
    byId("yt").innerHTML = "";
    state.pendingVideo = null;
    restoreFocus();
  }

  function showPlayerOverlay() {
    clearTimeout(state.overlayTimer);
    byId("playerOverlay").className = "player-overlay visible";
    state.overlayTimer = setTimeout(function () {
      byId("playerOverlay").className = "player-overlay";
    }, 3200);
  }

  function restoreFocus() {
    setTimeout(function () {
      if (state.lastFocused && document.body.contains(state.lastFocused)) {
        state.lastFocused.focus();
      } else {
        focusCard(state.focusRow, state.focusCol);
      }
    }, 50);
  }

  function bindActivate(element, handler) {
    if (!element) return;

    function onActivate(event) {
      activateOnce(event, handler);
    }

    element.onclick = onActivate;
    element.onmouseup = onActivate;
    element.onmousedown = onActivate;
    element.ontouchend = onActivate;

    if (element.addEventListener) {
      element.addEventListener("pointerup", onActivate, false);
      element.addEventListener("keyup", function (event) {
        if (event.key === "Enter" || event.key === " " || event.keyCode === 13 || event.keyCode === 32) {
          onActivate(event);
        }
      }, false);
    }
  }

  function activateOnce(event, handler) {
    var now = Date.now();
    if (now - state.lastActivation < 260) return;
    state.lastActivation = now;

    handler();

    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    return false;
  }

  function runSearch(query) {
    if (!query) {
      byId("suggestions").className = "suggestions";
      loadHome();
      return;
    }

    byId("content").innerHTML = skeletonRow("Resultados");
    tmdb.request("/search/multi", { query: query, include_adult: false })
      .then(function (data) {
        var movies = (data.results || []).filter(function (item) {
          return item.media_type === "movie" || item.media_type === "tv";
        });
        renderSearchSuggestions(movies.slice(0, 5));
        state.rowEls = [byId("content").querySelector(".row")];
        renderRow(0, "Resultados para \"" + query + "\"", movies);
      })
      .catch(function (error) {
        byId("content").innerHTML = '<div class="empty-state big">Erro na busca: ' + escapeHtml(error.message) + '</div>';
      });
  }

  function renderSearchSuggestions(items) {
    var suggestions = byId("suggestions");
    if (!items.length) {
      suggestions.className = "suggestions";
      suggestions.innerHTML = "";
      return;
    }

    suggestions.innerHTML = items.map(function (item) {
      return '<button class="suggestion focusable" type="button">' + escapeHtml(titleOf(item)) + '</button>';
    }).join("");
    suggestions.className = "suggestions open";

    Array.prototype.forEach.call(suggestions.querySelectorAll(".suggestion"), function (button, index) {
      bindActivate(button, function () {
        byId("searchInput").value = titleOf(items[index]);
        openDetails(items[index]);
      });
    });
  }

  function handleDirectional(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusCard(state.focusRow, state.focusCol + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCard(state.focusRow, state.focusCol - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCard(state.focusRow + 1, state.focusCol);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (state.focusRow <= 0) {
        byId("searchInput").focus();
      } else {
        focusCard(state.focusRow - 1, state.focusCol);
      }
    }
  }

  function isBackKey(event) {
    return event.key === "Backspace" ||
      event.key === "Escape" ||
      event.key === "BrowserBack" ||
      event.keyCode === 8 ||
      event.keyCode === 27 ||
      event.keyCode === 461 ||
      event.keyCode === 10009;
  }

  function handleKeydown(event) {
    var modalOpen = byId("modal").className.indexOf("open") !== -1;
    var detailsOpen = byId("detailsPanel").className.indexOf("open") !== -1;
    var enterPressed = event.key === "Enter" || event.key === "OK" || event.keyCode === 13;

    if (modalOpen) {
      showPlayerOverlay();
      if (isBackKey(event)) {
        event.preventDefault();
        closeModal();
      }
      return;
    }

    if (detailsOpen && isBackKey(event)) {
      event.preventDefault();
      closeDetails();
      return;
    }

    if (document.activeElement === byId("searchInput")) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusCard(0, 0);
      }
      return;
    }

    if (enterPressed) {
      event.preventDefault();
      activateTarget(document.activeElement, event);
      return;
    }

    handleDirectional(event);
  }

  function bindEvents() {
    bindActivate(byId("heroPlay"), function () {
      if (state.heroMovie) openTrailer(state.heroMovie);
    });

    bindActivate(byId("heroInfo"), function () {
      if (state.heroMovie) openDetails(state.heroMovie);
    });

    bindActivate(byId("closeButton"), closeModal);
    bindActivate(byId("detailsClose"), closeDetails);

    byId("searchInput").oninput = function () {
      var value = this.value.trim();
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(function () {
        runSearch(value);
      }, 320);
    };

    byId("app").addEventListener("click", function (event) {
      var target = event.target;
      while (target && target !== document.body) {
        if (target.className && String(target.className).indexOf("focusable") !== -1 && target.focus) {
          target.focus();
          break;
        }
        target = target.parentNode;
      }
    });

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousedown", handleGlobalActivation, true);
    document.addEventListener("mouseup", handleGlobalActivation, true);
    document.addEventListener("click", handleGlobalActivation, true);
    document.addEventListener("mousemove", showPlayerOverlay);
    document.addEventListener("cursorStateChange", function (event) {
      document.body.className = event.detail && event.detail.visibility ? "magic-cursor-visible" : "magic-cursor-hidden";
    });
    document.addEventListener("focusin", function (event) {
      if (event.target && event.target.className && String(event.target.className).indexOf("focusable") !== -1) {
        state.lastFocused = event.target;
      }
    });
  }

  function handleGlobalActivation(event) {
    var target = findInteractiveTarget(event.target);
    if (!target) return;

    activateTarget(target, event);
  }

  function activateTarget(target, event) {
    if (!target) return;

    if (target.id === "heroPlay") {
      activateOnce(event, function () {
        if (state.heroMovie) openTrailer(state.heroMovie);
      });
    } else if (target.id === "heroInfo") {
      activateOnce(event, function () {
        if (state.heroMovie) openDetails(state.heroMovie);
      });
    } else if (target.id === "detailsPlay") {
      activateOnce(event, function () {
        if (state.detailsMovie) openTrailer(state.detailsMovie);
      });
    } else if (target.id === "closeButton") {
      activateOnce(event, closeModal);
    } else if (target.id === "detailsClose") {
      activateOnce(event, closeDetails);
    } else if (hasClass(target, "card")) {
      activateOnce(event, function () {
        var movie = getCardMovie(target);
        if (movie) openDetails(movie);
      });
    }
  }

  function findInteractiveTarget(target) {
    while (target && target !== document.body) {
      if (target.id === "heroPlay" ||
        target.id === "heroInfo" ||
        target.id === "detailsPlay" ||
        target.id === "closeButton" ||
        target.id === "detailsClose" ||
        hasClass(target, "card")) {
        return target;
      }

      target = target.parentNode;
    }

    return null;
  }

  window.TrailerHubActions = {
    playHero: function (event) {
      return activateOnce(event, function () {
        if (state.heroMovie) {
          openTrailer(state.heroMovie);
        } else {
          showImmediatePlayerMessage("Ainda carregando o destaque...");
        }
      });
    },

    showHeroInfo: function (event) {
      return activateOnce(event, function () {
        if (state.heroMovie) openDetails(state.heroMovie);
      });
    },

    playDetails: function (event) {
      return activateOnce(event, function () {
        if (state.detailsMovie) {
          openTrailer(state.detailsMovie);
        } else if (state.heroMovie) {
          openTrailer(state.heroMovie);
        } else {
          showImmediatePlayerMessage("Ainda carregando o trailer...");
        }
      });
    },

    openCard: function (event, card) {
      return activateOnce(event, function () {
        var movie = getCardMovie(card);
        if (movie) openDetails(movie);
      });
    },

    closeDetails: function (event) {
      return activateOnce(event, closeDetails);
    },

    closePlayer: function (event) {
      return activateOnce(event, closeModal);
    }
  };

  function showImmediatePlayerMessage(message) {
    byId("modal").className = "modal open";
    byId("modal").setAttribute("aria-hidden", "false");
    byId("playerTitle").textContent = "Trailer Hub";
    byId("playerLoading").className = "player-status visible";
    byId("playerLoading").textContent = message;
    showPlayerOverlay();
  }

  window.onerror = function (message) {
    showImmediatePlayerMessage("Erro no app: " + String(message || "falha desconhecida"));
    return false;
  };

  function getCardMovie(card) {
    var row = Number(card.getAttribute("data-row"));
    var col = Number(card.getAttribute("data-col"));
    return state.rows[row] && state.rows[row][col] ? state.rows[row][col] : null;
  }

  function hasClass(element, className) {
    return !!(element && element.className && (" " + element.className + " ").indexOf(" " + className + " ") !== -1);
  }

  bindEvents();
  loadHome();
})(window, document);

(function (window, document) {
  "use strict";

  var tmdb = window.TrailerHubTMDB;
  var state = {
    rows: [],
    rowEls: [],
    focusRow: 0,
    focusCol: 0,
    heroMovie: null,
    player: null,
    playerReady: false,
    pendingVideo: null,
    searchTimer: null,
    overlayTimer: null,
    lastFocused: null
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
    return item.vote_average ? "★ " + Number(item.vote_average).toFixed(1) : "★ --";
  }

  function setHero(movie) {
    if (!movie) return;
    state.heroMovie = movie;

    byId("heroTitle").textContent = titleOf(movie);
    byId("heroMeta").textContent = [
      yearOf(movie),
      ratingOf(movie),
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

    var poster = tmdb.image(movie.poster_path, "w342");
    card.innerHTML = [
      '<span class="poster-wrap">',
      poster ? '<img class="poster lazy" loading="lazy" data-src="' + poster + '" alt="' + escapeHtml(titleOf(movie)) + '">' : '<span class="poster-fallback">' + escapeHtml(titleOf(movie)) + '</span>',
      '<span class="card-score">' + escapeHtml(ratingOf(movie)) + '</span>',
      '</span>',
      '<span class="card-title">' + escapeHtml(titleOf(movie)) + '</span>',
      '<span class="card-year">' + escapeHtml(yearOf(movie)) + '</span>'
    ].join("");

    card.onclick = function () {
      openDetails(movie);
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
    byId("detailsTitle").textContent = titleOf(movie);
    byId("detailsMeta").textContent = [yearOf(movie), ratingOf(movie), movie.media_type === "tv" ? "Série" : "Filme", "HD"].filter(Boolean).join("  •  ");
    byId("detailsOverview").textContent = movie.overview || "Trailer e detalhes disponíveis para este título.";
    byId("detailsBackdrop").src = tmdb.image(movie.backdrop_path, "original");
    byId("detailsPlay").onclick = function () {
      openTrailer(movie);
    };
    panel.className = "details-panel open";
    panel.setAttribute("aria-hidden", "false");
    byId("detailsPlay").focus();
  }

  function closeDetails(skipRestore) {
    byId("detailsPanel").className = "details-panel";
    byId("detailsPanel").setAttribute("aria-hidden", "true");
    if (!skipRestore) restoreFocus();
  }

  function getTrailer(movie) {
    var type = movie.media_type === "tv" || movie.first_air_date ? "tv" : "movie";
    return tmdb.request("/" + type + "/" + movie.id + "/videos", {})
      .then(function (data) {
        var videos = (data.results || []).filter(function (video) {
          return video.site === "YouTube" && video.key;
        });

        var preferred = videos.filter(function (video) {
          return video.type === "Trailer" && video.official;
        })[0] || videos.filter(function (video) {
          return video.type === "Trailer";
        })[0] || videos[0];

        return preferred ? preferred.key : null;
      });
  }

  function openTrailer(movie) {
    var modal = byId("modal");
    var loading = byId("playerLoading");
    closeDetails(true);
    byId("playerTitle").textContent = titleOf(movie);
    modal.className = "modal open";
    modal.setAttribute("aria-hidden", "false");
    loading.className = "player-status visible";
    loading.textContent = "Carregando trailer...";
    showPlayerOverlay();

    getTrailer(movie)
      .then(function (videoId) {
        if (!videoId) {
          loading.textContent = "Trailer não encontrado.";
          return;
        }

        if (state.playerReady && state.player) {
          loading.className = "player-status";
          state.player.loadVideoById(videoId);
        } else {
          state.pendingVideo = videoId;
        }
      })
      .catch(function () {
        loading.textContent = "Não foi possível carregar este trailer.";
      });
  }

  function closeModal() {
    byId("modal").className = "modal";
    byId("modal").setAttribute("aria-hidden", "true");
    if (state.player && state.player.stopVideo) state.player.stopVideo();
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
      button.onclick = function () {
        byId("searchInput").value = titleOf(items[index]);
        openDetails(items[index]);
      };
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

    if (modalOpen) {
      showPlayerOverlay();
      if (isBackKey(event)) {
        event.preventDefault();
        closeModal();
      } else if (event.key === "Enter" && state.player && state.player.getPlayerState) {
        event.preventDefault();
        state.player.getPlayerState() === 1 ? state.player.pauseVideo() : state.player.playVideo();
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

    handleDirectional(event);
  }

  function bindEvents() {
    byId("heroPlay").onclick = function () {
      if (state.heroMovie) openTrailer(state.heroMovie);
    };

    byId("heroInfo").onclick = function () {
      if (state.heroMovie) openDetails(state.heroMovie);
    };

    byId("closeButton").onclick = closeModal;
    byId("detailsClose").onclick = closeDetails;

    byId("searchInput").oninput = function () {
      var value = this.value.trim();
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(function () {
        runSearch(value);
      }, 320);
    };

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousemove", showPlayerOverlay);
    document.addEventListener("focusin", function (event) {
      if (event.target && event.target.className && String(event.target.className).indexOf("focusable") !== -1) {
        state.lastFocused = event.target;
      }
    });
  }

  window.onYouTubeIframeAPIReady = function () {
    state.player = new YT.Player("yt", {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 0,
        rel: 0,
        playsinline: 1,
        modestbranding: 1
      },
      events: {
        onReady: function () {
          state.playerReady = true;
          if (state.pendingVideo) {
            byId("playerLoading").className = "player-status";
            state.player.loadVideoById(state.pendingVideo);
            state.pendingVideo = null;
          }
        }
      }
    });
  };

  bindEvents();
  loadHome();
})(window, document);

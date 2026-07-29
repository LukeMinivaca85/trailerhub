(function (window) {
  "use strict";

  var API_KEY = "a47898db471d486bdee5adf41ba00783";
  var API_BASE = "https://api.themoviedb.org/3";
  var IMAGE_BASE = "https://image.tmdb.org/t/p";
  var CACHE_PREFIX = "trailerhub:";
  var CACHE_TTL = 1000 * 60 * 60 * 6;

  function encodeParams(params) {
    params = params || {};

    var query = [
      "api_key=" + encodeURIComponent(API_KEY),
      "language=" + encodeURIComponent(params.language || "pt-BR")
    ];

    Object.keys(params).forEach(function (key) {
      if (key === "language") return;
      query.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
    });

    return query.join("&");
  }

  function readCache(key) {
    try {
      var raw = window.localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.time > CACHE_TTL) return null;
      return cached.data;
    } catch (error) {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        time: Date.now(),
        data: data
      }));
    } catch (error) {
      /* TVs can have tiny storage quotas. Network still works without cache. */
    }
  }

  function request(path, params) {
    var key = path + "?" + encodeParams(params || {});
    var cached = readCache(key);
    if (cached) return Promise.resolve(cached);

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", API_BASE + path + "?" + encodeParams(params || {}), true);
      xhr.timeout = 18000;

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = JSON.parse(xhr.responseText);
            writeCache(key, data);
            resolve(data);
          } catch (error) {
            reject(new Error("Resposta inválida do catálogo."));
          }
          return;
        }

        reject(new Error("Catálogo indisponível no momento."));
      };

      xhr.onerror = function () {
        reject(new Error("Sem conexão com o catálogo."));
      };

      xhr.ontimeout = function () {
        reject(new Error("A conexão demorou demais."));
      };

      xhr.send();
    });
  }

  function image(path, size) {
    if (!path) return "";
    return IMAGE_BASE + "/" + (size || "w780") + path;
  }

  window.TrailerHubTMDB = {
    request: request,
    image: image
  };
})(window);

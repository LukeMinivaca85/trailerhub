# Trailer Hub

Premium trailer experience for Smart TVs and modern browsers.

## Run locally

```bash
npm run serve
```

Open:

```text
http://localhost:8080
```

## Quality

```bash
npm install
npm run lint
npm run format
```

## TV Targets

- LG webOS first
- Samsung Tizen
- Android TV / Google TV
- Xbox Edge
- PlayStation Browser
- Modern desktop browsers

## Package

LG webOS:

```bash
ares-package .
```

Samsung Tizen:

```bash
tizen build-web
tizen package -t wgt -s default
```

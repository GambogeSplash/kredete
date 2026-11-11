// Held-out allowed sites for bot-form.js (bot admin plan AW1.1). Written before any origin
// code, and never edited to make that code pass. Each expected result is the server's own:
// broth-service `broth.bots.settings.normalize_origin(input, environment=Environment.DEV)`,
// generated with:
//
//   from broth.bots.settings import normalize_origin, InvalidOriginError
//   from broth.config import Environment
//   for raw in INPUTS:
//       try: print({"input": raw, "origin": normalize_origin(raw, environment=Environment.DEV)})
//       except InvalidOriginError as e: print({"input": raw, "error": str(e)})
//
// The client cannot know the environment, so it lets http://localhost through everywhere and
// the server refuses it outside dev and test; DEV is the environment that matches. An entry
// with `error` must be refused (the reason may be worded for people); one with `origin` must
// come back as exactly that.
export const ORIGINS = 
[
 {
  "input": "https://help.kredete.com",
  "origin": "https://help.kredete.com"
 },
 {
  "input": "https://help.kredete.com/",
  "origin": "https://help.kredete.com"
 },
 {
  "input": "  https://help.kredete.com  ",
  "origin": "https://help.kredete.com"
 },
 {
  "input": "HTTPS://Help.Kredete.COM",
  "origin": "https://help.kredete.com"
 },
 {
  "input": "https://help.kredete.com:443",
  "origin": "https://help.kredete.com"
 },
 {
  "input": "https://help.kredete.com:8443",
  "origin": "https://help.kredete.com:8443"
 },
 {
  "input": "https://help.kredete.com:0",
  "error": "a site must be a valid URL"
 },
 {
  "input": "https://help.kredete.com:65536",
  "error": "a site must be a valid URL"
 },
 {
  "input": "https://docs.example.co.uk",
  "origin": "https://docs.example.co.uk"
 },
 {
  "input": "https://xn--bcher-kva.example",
  "origin": "https://xn--bcher-kva.example"
 },
 {
  "input": "https://bücher.example",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://help.kredete.com.",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://[::1]",
  "origin": "https://[::1]"
 },
 {
  "input": "https://[2001:db8::1]:8443",
  "origin": "https://[2001:db8::1]:8443"
 },
 {
  "input": "https://127.0.0.1",
  "origin": "https://127.0.0.1"
 },
 {
  "input": "https://10.0.0.5:3000",
  "origin": "https://10.0.0.5:3000"
 },
 {
  "input": "http://localhost",
  "origin": "http://localhost"
 },
 {
  "input": "http://localhost:3000",
  "origin": "http://localhost:3000"
 },
 {
  "input": "http://LOCALHOST:8080/",
  "origin": "http://localhost:8080"
 },
 {
  "input": "https://localhost:5173",
  "origin": "https://localhost:5173"
 },
 {
  "input": "http://help.kredete.com",
  "error": "a site must use https"
 },
 {
  "input": "http://127.0.0.1:3000",
  "error": "a site must use https"
 },
 {
  "input": "ftp://help.kredete.com",
  "error": "a site must use https"
 },
 {
  "input": "help.kredete.com",
  "error": "a site is a scheme, host and port only, without a path"
 },
 {
  "input": "//help.kredete.com",
  "error": "a site must use https"
 },
 {
  "input": "https://help.kredete.com/docs",
  "error": "a site is a scheme, host and port only, without a path"
 },
 {
  "input": "https://help.kredete.com/docs/",
  "error": "a site is a scheme, host and port only, without a path"
 },
 {
  "input": "https://help.kredete.com?x=1",
  "error": "a site is a scheme, host and port only, without a path"
 },
 {
  "input": "https://help.kredete.com#top",
  "error": "a site is a scheme, host and port only, without a path"
 },
 {
  "input": "https://user:pw@help.kredete.com",
  "error": "a site cannot carry a user name or password"
 },
 {
  "input": "https://user@help.kredete.com",
  "error": "a site cannot carry a user name or password"
 },
 {
  "input": "https://*.kredete.com",
  "error": "a site cannot contain a wildcard"
 },
 {
  "input": "*",
  "error": "a site cannot contain a wildcard"
 },
 {
  "input": "",
  "error": "a site needs a valid host"
 },
 {
  "input": "   ",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://help kredete.com",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://help_kredete.com",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://-bad.kredete.com",
  "error": "a site needs a valid host"
 },
 {
  "input": "https://help.kredete.com:abc",
  "error": "a site must be a valid URL"
 },
 {
  "input": "javascript:alert(1)",
  "error": "a site is a scheme, host and port only, without a path"
 },
 {
  "input": "https://a.b",
  "origin": "https://a.b"
 }
]
;

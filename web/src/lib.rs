//! First strangler slice: public discovery and legacy redirects.
//! Pure rendering is native-testable; only the workers-rs entry talks to the edge.

pub const ROBOTS: &str = include_str!("../robots.txt");
const BASE: &str = "https://chrondle.app";

pub fn redirect(path: &str, query: Option<&str>) -> Option<String> {
    let target = match path {
        "/releases" => return Some("/changelog".into()),
        "/groups" => "/",
        "/archive/groups" => "/archive",
        p if p.starts_with("/archive/groups/") => "/archive",
        _ => return None,
    };
    Some(match query.filter(|q| !q.is_empty()) {
        Some(q) => format!("{target}?{q}"),
        None => target.into(),
    })
}

pub fn sitemap(counts: Option<(u64, u64)>, now: &str) -> String {
    use std::fmt::Write;
    let mut xml = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n",
    );
    for (path, frequency, priority, dated) in [
        ("", "daily", "1", true),
        ("/classic", "daily", "0.9", true),
        ("/order", "daily", "0.9", true),
        ("/archive", "daily", "0.8", true),
        ("/archive/order", "daily", "0.8", true),
        ("/legal/privacy", "monthly", "0.3", false),
        ("/legal/terms", "monthly", "0.3", false),
    ] {
        write!(xml, "<url><loc>{BASE}{path}</loc>").unwrap();
        if dated {
            write!(xml, "<lastmod>{now}</lastmod>").unwrap();
        }
        writeln!(
            xml,
            "<changefreq>{frequency}</changefreq><priority>{priority}</priority></url>"
        )
        .unwrap();
    }
    if let Some((classic, order)) = counts {
        for (prefix, count) in [("/archive/puzzle", classic), ("/archive/order", order)] {
            for number in 1..=count {
                writeln!(xml, "<url><loc>{BASE}{prefix}/{number}</loc><changefreq>never</changefreq><priority>0.6</priority></url>").unwrap();
            }
        }
    }
    xml.push_str("</urlset>\n");
    xml
}

#[cfg(target_arch = "wasm32")]
mod edge {
    use super::*;
    use serde_json::{json, Value};
    use worker::{event, Context, Env, Fetch, Method, Request, RequestInit, Response, Result};

    async fn count(env: &Env, path: &str, args: Value, field: &str) -> Result<u64> {
        // Same anonymous Convex HTTP boundary as the retained client. Never copy
        // cookies, authorization, URL queries or caller-controlled origins.
        let origin = env.var("NEXT_PUBLIC_CONVEX_URL")?.to_string();
        let mut init = RequestInit::new();
        init.with_method(Method::Post).with_body(Some(
            json!({"path": path, "format": "convex_encoded_json", "args": [args]})
                .to_string()
                .into(),
        ));
        let mut request = Request::new_with_init(
            &format!("{}/api/query", origin.trim_end_matches('/')),
            &init,
        )?;
        request
            .headers_mut()?
            .set("Content-Type", "application/json")?;
        let mut response = Fetch::Request(request).send().await?;
        if response.status_code() != 200 {
            return Err(worker::Error::RustError(
                "sitemap backend unavailable".into(),
            ));
        }
        let body: Value = response.json().await?;
        if body["status"] != "success" {
            return Err(worker::Error::RustError("sitemap query refused".into()));
        }
        body["value"][field]
            .as_u64()
            .ok_or_else(|| worker::Error::RustError("sitemap count invalid".into()))
    }

    async fn counts(env: &Env) -> Result<(u64, u64)> {
        let classic = count(env, "puzzles:getTotalPuzzles", json!({}), "count").await?;
        let order = count(
            env,
            "orderPuzzles:getArchiveOrderPuzzles",
            json!({"page": 1, "pageSize": 1}),
            "totalCount",
        )
        .await?;
        Ok((classic, order))
    }

    #[event(fetch)]
    async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
        let path = req.path();
        let mut response = if let Some(target) = redirect(&path, req.url()?.query()) {
            let mut response = Response::empty()?.with_status(308);
            response.headers_mut().set("Location", &target)?;
            response
        } else if matches!(path.as_str(), "/robots.txt" | "/sitemap.xml") {
            if !matches!(req.method(), Method::Get | Method::Head) {
                let mut response = Response::empty()?.with_status(405);
                response.headers_mut().set("Allow", "GET, HEAD")?;
                response
            } else {
                let (body, content_type) = if path == "/robots.txt" {
                    (ROBOTS.to_string(), "text/plain; charset=utf-8")
                } else {
                    let counts = counts(&env).await;
                    if counts.is_err() {
                        // Do not log provider bodies, puzzle data or request headers.
                        worker::console_warn!(
                            "sitemap archive counts unavailable; serving static routes"
                        );
                    }
                    let now = js_sys::Date::new_0().to_iso_string();
                    (
                        sitemap(counts.ok(), &String::from(now)),
                        "application/xml; charset=utf-8",
                    )
                };
                let mut response = if req.method() == Method::Head {
                    Response::empty()?
                } else {
                    Response::ok(body)?
                };
                response.headers_mut().set("Content-Type", content_type)?;
                response
            }
        } else {
            // Unmarked 404 means fall through to the retained OpenNext Worker.
            // No body read, auth handshake, backend read or mutation occurred.
            return Ok(Response::empty()?.with_status(404));
        };
        response.headers_mut().set("X-Chrondle-Runtime", "rust")?;
        response.headers_mut().set(
            "X-Chrondle-Revision",
            option_env!("CHRONDLE_REVISION").unwrap_or("development"),
        )?;
        response
            .headers_mut()
            .set("Cache-Control", "public, max-age=0, must-revalidate")?;
        response
            .headers_mut()
            .set("X-Content-Type-Options", "nosniff")?;
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_links_keep_their_existing_query_semantics() {
        assert_eq!(
            redirect("/groups", Some("x=1&x=2")),
            Some("/?x=1&x=2".into())
        );
        assert_eq!(
            redirect("/archive/groups/42", Some("x=%2F")),
            Some("/archive?x=%2F".into())
        );
        assert_eq!(redirect("/archive/groups", None), Some("/archive".into()));
        assert_eq!(
            redirect("/releases", Some("from=legacy")),
            Some("/changelog".into())
        );
        for path in [
            "/groups-other",
            "/archive/groups-other",
            "/releases/1.13.1",
            "/api/stripe/checkout",
            "/classic",
        ] {
            assert_eq!(redirect(path, None), None, "{path}");
        }
    }

    #[test]
    fn sitemap_preserves_static_and_counted_routes_without_answers() {
        let xml = sitemap(Some((2, 1)), "2026-10-16T00:00:00.000Z");
        assert_eq!(xml.matches("<url>").count(), 10);
        assert_eq!(xml.matches("<lastmod>").count(), 5);
        assert!(xml.contains("<loc>https://chrondle.app/archive/puzzle/2</loc>"));
        assert!(xml.contains("<loc>https://chrondle.app/archive/order/1</loc>"));
        assert!(!xml.contains("/archive/puzzle/3"));
        assert!(!xml.contains("targetYear"));
        assert_eq!(
            sitemap(None, "2026-10-16T00:00:00.000Z")
                .matches("<url>")
                .count(),
            7
        );
        assert_eq!(
            sitemap(Some((0, 0)), "2026-10-16T00:00:00.000Z")
                .matches("<url>")
                .count(),
            7
        );
    }
}

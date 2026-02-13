use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
    duration_ms: u128,
}

#[tauri::command]
async fn send_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let start = std::time::Instant::now();
    
    // Create HTTP client
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true) // Allow self-signed certificates
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Build the request based on method
    let mut req_builder = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&request.url),
        "POST" => client.post(&request.url),
        "PUT" => client.put(&request.url),
        "DELETE" => client.delete(&request.url),
        "PATCH" => client.patch(&request.url),
        "HEAD" => client.head(&request.url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &request.url),
        _ => return Err(format!("Unsupported HTTP method: {}", request.method)),
    };

    // Add headers
    for (key, value) in request.headers {
        req_builder = req_builder.header(&key, &value);
    }

    // Add body if present
    if let Some(body) = request.body {
        if !body.is_empty() {
            req_builder = req_builder.body(body);
        }
    }

    // Send the request
    let response = req_builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    // Extract response details
    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("Unknown").to_string();
    
    // Extract headers
    let mut headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(value_str) = value.to_str() {
            headers.insert(key.to_string(), value_str.to_string());
        }
    }

    // Get response body
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let duration_ms = start.elapsed().as_millis();

    Ok(HttpResponse {
        status,
        status_text,
        headers,
        body,
        duration_ms,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())

        .setup(|app| {
             let handle = app.handle();
             let about_menu = tauri::menu::PredefinedMenuItem::about(
                handle,
                Some("About BadRest"),
                Some(tauri::menu::AboutMetadata {
                    name: Some("BadRest".to_string()),
                    version: Some("0.2.0".to_string()),
                    copyright: Some("A beautiful, modern, and lightweight REST API Client by Iskandar Dzulkarnain".to_string()),
                    ..Default::default()
                }),
             )?;
             
             // On macOS, the default menu is created by `Menu::default`. 
             // We need to replace the default app menu or just set this metadata globally if possible?
             // In Tauri v2, `Menu::default` creates the standard menu. 
             // To customize the About item specifically in the default menu is slightly tricky without rebuilding the whole menu.
             
             // Alternative: Reconstruct the menu.
             use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};
             
             let app_name = "BadRest";
             let about_item = PredefinedMenuItem::about(
                 handle,
                 Some("About BadRest"),
                 Some(tauri::menu::AboutMetadata {
                     name: Some("BadRest".to_string()),
                     version: Some("0.2.0".to_string()),
                     copyright: Some("by Iskandar Dzulkarnain".to_string()),
                     comments: Some("A beautiful, modern, and lightweight REST API Client".to_string()),
                     ..Default::default()
                 })
             )?;
             
             let quit_item = PredefinedMenuItem::quit(handle, Some("Quit BadRest"))?;
             let separator = PredefinedMenuItem::separator(handle)?;
             let app_submenu = Submenu::with_items(
                 handle,
                 app_name,
                 true,
                 &[&about_item, &separator, &quit_item]
             )?;
             
             let close_item = PredefinedMenuItem::close_window(handle, Some("Close"))?;
             let file_menu = Submenu::with_items(
                handle, 
                "File", 
                true, 
                &[&close_item]
             )?;
             
             let undo = PredefinedMenuItem::undo(handle, None)?;
             let redo = PredefinedMenuItem::redo(handle, None)?;
             let cut = PredefinedMenuItem::cut(handle, None)?;
             let copy = PredefinedMenuItem::copy(handle, None)?;
             let paste = PredefinedMenuItem::paste(handle, None)?;
             let select_all = PredefinedMenuItem::select_all(handle, None)?;
             let sep1 = PredefinedMenuItem::separator(handle)?;
             
             let edit_menu = Submenu::with_items(
                handle,
                "Edit",
                true,
                &[
                    &undo,
                    &redo,
                    &sep1,
                    &cut,
                    &copy,
                    &paste,
                    &select_all,
                ]
             )?;
             
             let fullscreen = PredefinedMenuItem::fullscreen(handle, None)?;
             let view_menu = Submenu::with_items(
                handle,
                "View",
                true,
                &[&fullscreen]
             )?;
             
             let minimize = PredefinedMenuItem::minimize(handle, None)?;
             let window_menu = Submenu::with_items(
                handle,
                "Window",
                true,
                &[
                    &minimize,
                ]
             )?;
             let menu = Menu::with_items(handle, &[&app_submenu, &file_menu, &edit_menu, &view_menu, &window_menu])?;
             app.set_menu(menu)?;
             
             Ok(())
        })
        .invoke_handler(tauri::generate_handler![send_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

<!doctype html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'LivrariaHub')</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .panel { width: 100%; max-width: 420px; background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 28px; }
        h1 { margin: 0 0 8px; font-size: 1.35rem; }
        p.lead { margin: 0 0 20px; color: #94a3b8; font-size: 0.95rem; }
        label { display: block; margin: 14px 0 6px; font-size: 0.9rem; color: #cbd5e1; }
        input[type="text"], input[type="email"], input[type="password"] { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; }
        .check { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 0.9rem; color: #94a3b8; }
        .btn { margin-top: 18px; width: 100%; padding: 11px 14px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 1rem; }
        .btn:hover { background: #1d4ed8; }
        .links { margin-top: 18px; text-align: center; font-size: 0.9rem; color: #94a3b8; }
        .links a { color: #93c5fd; text-decoration: none; }
        .links a:hover { text-decoration: underline; }
        .error { color: #fca5a5; font-size: 0.85rem; margin-top: 4px; }
        ul.errors { margin: 12px 0 0; padding-left: 18px; color: #fca5a5; font-size: 0.85rem; }
    </style>
</head>
<body>
    <div class="panel">
        @yield('content')
    </div>
</body>
</html>

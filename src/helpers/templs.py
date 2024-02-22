#!/usr/bin/env python
# -*- coding: utf-8 -*-

template_entrypoint = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Oysape</title>
</head>
<body>
    <div class="container mt-5 col-6" style="text-align: center;">
        <!-- <img src="/static/logo192.png" alt="Oysape logo"><br/> -->
        <img src="/static/loading.gif" alt="Loading..." style="width: 512px;">
    </div>
</body>
</html>
"""

template_signin_page = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        .btn {
            width: 300px;
            margin: 10px;
        }
    </style>
</head>
<body>
    <div class="container mt-5 col-6" style="text-align: center;">
        <img src="/static/logo192.png" alt="Oysape logo"><br/>
        <h1>{{ title }}</h1>
        <a href="javascript:window.pywebview.api.signInWithGithub('{{ state }}');" class="btn btn-primary" style="display: {{ 'inline-block' if showGithubSignin else 'none' }};"><i class="bi bi-github"></i> Sign in with GitHub</a><br/>
        <a href="javascript:window.pywebview.api.signInWithGoogle('{{ state }}');" class="btn btn-primary" style="display: {{ 'inline-block' if showGoogleSignin else 'none' }};"><i class="bi bi-google"></i> Sign in with Google</a>
        <a href="javascript:window.pywebview.api.tryToPrepareToSignIn();" class="btn btn-primary" style="display: {{ 'inline-block' if showTryAgain else 'none' }};">Try again</a>
        <div class="alert alert-danger" role="alert" style="display: {{ 'block' if errinfo else 'none' }};" id="alert-box">{{ errinfo }}</div>
    </div>
    <script>
        function showError(msg) {
            document.getElementById('alert-box').style.display = 'block';
            document.getElementById('alert-box').innerHTML = msg;
        }
        function clearError() {
            document.getElementById('alert-box').style.display = 'none';
            document.getElementById('alert-box').innerHTML = '';
        }
    </script>
</body>
</html>
"""

template_signin_success = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Success</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css">
</head>
<body>
    <div class="container mt-5 col-6" style="text-align: center;">
        <h2>Success! You can close this window now.</h2>
    </div>
    <script>
        setTimeout(function(){window.close();},50);
    </script>
</body>
</html>
"""

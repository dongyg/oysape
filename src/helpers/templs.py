#!/usr/bin/env python
# -*- coding: utf-8 -*-

template_signin_success = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Success</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
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

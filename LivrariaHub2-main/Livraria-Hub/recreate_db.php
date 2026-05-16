<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', '');
    $pdo->exec('DROP DATABASE IF EXISTS livrariahub;');
    $pdo->exec('CREATE DATABASE livrariahub;');
    echo 'Database recreated successfully.';
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}

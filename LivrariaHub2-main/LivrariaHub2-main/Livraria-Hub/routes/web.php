<?php

use App\Http\Controllers\LivroController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::view('/', 'catalogo')->name('home');
    Route::view('/catalogo', 'catalogo')->name('catalogo');
    Route::get('/api/livros', [LivroController::class, 'index']);
});

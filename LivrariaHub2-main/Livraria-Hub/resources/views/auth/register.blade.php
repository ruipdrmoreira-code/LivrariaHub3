@extends('layouts.guest')

@section('title', 'Criar conta — LivrariaHub')

@section('content')
    <h1>Criar conta</h1>
    <p class="lead">Regista-te para acederes ao catálogo LivrariaHub.</p>

    <form method="POST" action="{{ route('register.store') }}">
        @csrf
        <label for="name">Nome</label>
        <input id="name" type="text" name="name" value="{{ old('name') }}" required autocomplete="name" autofocus>
        @error('name')
            <div class="error">{{ $message }}</div>
        @enderror

        <label for="email">Email</label>
        <input id="email" type="email" name="email" value="{{ old('email') }}" required autocomplete="username">
        @error('email')
            <div class="error">{{ $message }}</div>
        @enderror

        <label for="password">Palavra-passe</label>
        <input id="password" type="password" name="password" required autocomplete="new-password">
        @error('password')
            <div class="error">{{ $message }}</div>
        @enderror

        <label for="password_confirmation">Confirmar palavra-passe</label>
        <input id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">

        <button type="submit" class="btn">Registar</button>
    </form>

    <div class="links">
        Já tens conta? <a href="{{ route('login') }}">Entrar</a>
    </div>
@endsection

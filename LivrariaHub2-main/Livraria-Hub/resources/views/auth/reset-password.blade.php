@extends('layouts.guest')

@section('title', 'Nova palavra-passe — LivrariaHub')

@section('content')
    <h1>Nova palavra-passe</h1>
    <p class="lead">Escolhe uma nova palavra-passe para a tua conta.</p>

    <form method="POST" action="{{ route('password.update') }}">
        @csrf
        <input type="hidden" name="token" value="{{ $request->route('token') }}">

        <label for="email">Email</label>
        <input id="email" type="email" name="email" value="{{ old('email', $request->email) }}" required autofocus>
        @error('email')
            <div class="error">{{ $message }}</div>
        @enderror

        <label for="password">Nova palavra-passe</label>
        <input id="password" type="password" name="password" required autocomplete="new-password">
        @error('password')
            <div class="error">{{ $message }}</div>
        @enderror

        <label for="password_confirmation">Confirmar</label>
        <input id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">

        <button type="submit" class="btn">Guardar</button>
    </form>

    <div class="links">
        <a href="{{ route('login') }}">Voltar ao login</a>
    </div>
@endsection

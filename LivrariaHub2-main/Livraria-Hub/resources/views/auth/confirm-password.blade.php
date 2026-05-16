@extends('layouts.guest')

@section('title', 'Confirmar palavra-passe — LivrariaHub')

@section('content')
    <h1>Confirmar palavra-passe</h1>
    <p class="lead">Por segurança, confirma a tua palavra-passe para continuar.</p>

    <form method="POST" action="{{ route('password.confirm.store') }}">
        @csrf
        <label for="password">Palavra-passe</label>
        <input id="password" type="password" name="password" required autocomplete="current-password" autofocus>
        @error('password')
            <div class="error">{{ $message }}</div>
        @enderror

        <button type="submit" class="btn">Confirmar</button>
    </form>
@endsection

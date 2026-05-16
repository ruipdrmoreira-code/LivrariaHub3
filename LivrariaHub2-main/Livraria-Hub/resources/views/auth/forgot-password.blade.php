@extends('layouts.guest')

@section('title', 'Recuperar palavra-passe — LivrariaHub')

@section('content')
    <h1>Recuperar palavra-passe</h1>
    <p class="lead">Indica o teu email e enviamos um link para redefinires a palavra-passe.</p>

    @if (session('status'))
        <p style="color:#86efac;font-size:0.9rem;">{{ session('status') }}</p>
    @endif

    <form method="POST" action="{{ route('password.email') }}">
        @csrf
        <label for="email">Email</label>
        <input id="email" type="email" name="email" value="{{ old('email') }}" required autofocus>
        @error('email')
            <div class="error">{{ $message }}</div>
        @enderror

        <button type="submit" class="btn">Enviar link</button>
    </form>

    <div class="links">
        <a href="{{ route('login') }}">Voltar ao login</a>
    </div>
@endsection

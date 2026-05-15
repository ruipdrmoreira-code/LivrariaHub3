@extends('layouts.guest')

@section('title', 'Entrar — LivrariaHub')

@section('content')
    <h1>Entrar</h1>
    <p class="lead">Inicia sessão para veres o catálogo de livros escolares.</p>

    <form method="POST" action="{{ route('login.store') }}">
        @csrf
        <label for="email">Email</label>
        <input id="email" type="email" name="email" value="{{ old('email') }}" required autocomplete="username" autofocus>
        @error('email')
            <div class="error">{{ $message }}</div>
        @enderror

        <label for="password">Palavra-passe</label>
        <input id="password" type="password" name="password" required autocomplete="current-password">
        @error('password')
            <div class="error">{{ $message }}</div>
        @enderror

        <div class="check">
            <input id="remember" type="checkbox" name="remember">
            <label for="remember" style="margin:0;">Manter sessão</label>
        </div>

        @if ($errors->any() && ! $errors->has('email') && ! $errors->has('password'))
            <ul class="errors">
                @foreach ($errors->all() as $err)
                    <li>{{ $err }}</li>
                @endforeach
            </ul>
        @endif

        <button type="submit" class="btn">Entrar</button>
    </form>

    <div class="links">
        <a href="{{ route('register') }}">Criar conta</a>
        @if (Route::has('password.request'))
            &nbsp;·&nbsp;
            <a href="{{ route('password.request') }}">Esqueci-me da palavra-passe</a>
        @endif
    </div>
@endsection

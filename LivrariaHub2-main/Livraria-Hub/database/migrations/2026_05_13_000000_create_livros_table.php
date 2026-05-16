<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('livros')) {
            return;
        }

        Schema::create('livros', function (Blueprint $table) {
            $table->id();
            $table->string('editora', 255)->nullable();
            $table->string('disciplina', 255)->nullable();
            $table->smallInteger('ano_escolar')->nullable();
            $table->string('tipo', 64)->nullable();
            $table->string('titulo', 255);
            $table->string('isbn', 32)->unique();
            $table->string('codigo_interno', 64)->nullable();
            $table->decimal('preco', 10, 2)->default(0);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('livros');
    }
};

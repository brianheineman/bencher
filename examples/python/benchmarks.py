import fbf

FIZZ_RESULT = "FizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNoneFizzNoneNone"
FIZZ_BUZZ_RESULT = "FizzBuzzNoneNoneFizzNoneBuzzFizzNoneNoneFizzBuzzNoneFizzNoneNoneFizzBuzzNoneNoneFizzNoneBuzzFizzNoneNoneFizzBuzzNoneFizzNoneNoneFizzBuzzNoneNoneFizzNoneBuzzFizzNoneNoneFizzBuzzNone"
FIZZ_BUZZ_FIBONACCI_RESULT = "0NoneNoneFizzNoneBuzzFizz13NoneFizzBuzzNoneFizzNone377FizzBuzzNoneNoneFizzNoneBuzz10946NoneNoneFizzBuzzNoneFizz317811NoneFizzBuzzNoneNoneFizzNone9227465FizzNoneNoneFizzBuzzNone"


# def test_run_v1(benchmark):
#     result = benchmark(fbf.run_v1)
#     assert result == FIZZ_RESULT


# def test_run_v2(benchmark):
#     result = benchmark(fbf.run_v2)
#     assert result == FIZZ_BUZZ_RESULT


# def test_run_v3(benchmark):
#     result = benchmark(fbf.run_v3)
#     assert result == FIZZ_BUZZ_FIBONACCI_RESULT


# def test_run_v4(benchmark):
#     result = benchmark(fbf.run_v4)
#     assert result == FIZZ_BUZZ_FIBONACCI_RESULT


# def test_fibonacci_28(benchmark):
#     result = benchmark(fbf.fibonacci, 28)
#     assert result == 317811


# def test_fibonacci_28_memo(benchmark):
#     result = benchmark(fbf.fibonacci_memo, 28)
#     assert result == 317811

def test_fibonacci(benchmark):
    def fibonacci_month():
        for n in range(1, 32, 7):
            fbf.fibonacci(n)
    benchmark(fibonacci_month)

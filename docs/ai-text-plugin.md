https://perchance.org/ai-text-plugin

Prompt Options:

You can see a bunch of the options below at play in the example generators listed above, and in this sandbox demo made by wthit56.

instruction - Your instruction to the AI on what to write.
startWith - The text that you want the AI's writing to start with.
stopSequences - The AI will stop writing "naturally" when it thinks it's finished, but you can use stopSequences to provide a list of words/phrases that should make the AI stop if it writes them.
hideStartWith - set this equal to true if you don't want the startWith text that you specified to actually get displayed. I.e. only the text after that will get displayed. You could also use a custom render(data) function (explained below) to achieve this.
outputTo - Use this to tell the plugin to output the AI's response into a specific element, based on that element's ID. If you had an element with id="myCoolElement" in the HTML editor, then you'd write outputTo = [myCoolElement] to get the AI to output to that element. By default the AI's text will be put wherever you write [ai(...)].
onChunk(data) - the code you put in this will run after every chunk (which is usually a word, or part of a word). See this generator for an example that uses it. You can access data.textChunk and data.fullTextSoFar and data.isFromStartWith (since the startWith text, if specified, is always the first chunk).
onStart(data) - the code you put in this will run at the start of the generation process. You can access the inputs being used with data.inputs.instruction, data.inputs.startWith, etc.
onFinish(data) - the code you put in this will run at the end of the generation process. You can access the final text with data.text, and note that this includes the startWith text, if you specified any. If you want the output text excluding the startWith, then you can access that via data.generatedText. If you didn't specify any startWith then data.generatedText and data.text will be the same. You can use data.liveResponseText at any time to get the current text including any edits that the user has made using the edit button at the end of the response.
render(data) - the code you put in this will run after every chunk, and value that you return from this function is what actually gets displayed. This allows you to transform what the AI writes into something else - e.g. convert asterisks around text to bold or italic HTML tags. data.text contains the text so far and data.isPartial tells you whether the text is partial/incomplete (i.e. the AI is still generating). Here's a basic example, and here's one that uses data.isPartial.
endButtons - add endButtons = none to your prompt options if you don't want the edit/continue buttons to show at the end of the response.
Note that instruction, startWith, and stopSequences can all be functions if you want. You return the value that you want to use. See this generator for an example where we use it to prevent evaluation of the square and curly blocks in the given instruction and startWith.
There are some other features not listed here, but they're used in the examples list above. If there's a feature that you want, but can't find, feel free to ask for it on the community forum.
Here's an example of using it in JavaScript function where we console.log each chunk, and also the final generatedText:
```js
async start() =>
  let result = await ai({
    instruction: "write a poem",
    onChunk: function(data) {
      console.log("chunk:", data);
    },
  });
  console.log(result.generatedText, result);
```
The result.text includes the startWith text, whereas result.generatedText doesn't, but in the above example they're equivalent because we didn't specify a startWith. Also note that result is also actually a String which is equivalent to result.text. So you can just write e.g. foo.innerHTML = result instead of foo.innerHTML = result.text.
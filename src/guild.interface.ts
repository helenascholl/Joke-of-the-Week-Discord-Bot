import Joke from './joke.interface';

interface Guild {
  id: string;
  channel: string;
  jokes: Joke[];
}

export default Guild;
